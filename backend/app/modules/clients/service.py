"""Clientes e endereços.

Mesma regra de ouro de todo o sistema: toda consulta filtra pelo company_id
de quem pede. Cliente ou endereço de outra empresa "não existe" (404).
"""

import re
import uuid

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.core.errors import ConflictError, NotFoundError
from app.modules.audit import service as audit
from app.modules.audit.models import AuditAction
from app.modules.clients.models import Client, ClientAddress
from app.modules.clients.schemas import (
    AddressIn,
    AddressUpdate,
    ClientCreate,
    ClientListItem,
    ClientUpdate,
)
from app.modules.users.models import User

MAX_ADDRESSES = 10
_NON_DIGITS = re.compile(r"\D")


def list_clients(
    db: Session,
    company_id: uuid.UUID,
    *,
    search: str | None = None,
    include_inactive: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[ClientListItem], int]:
    stmt = select(Client).where(Client.company_id == company_id)
    if not include_inactive:
        stmt = stmt.where(Client.is_active.is_(True))
    if search:
        conditions = [Client.name.icontains(search, autoescape=True)]
        # "98765-4321" ou "(11) 9876" → busca pelos dígitos no telefone salvo.
        digits = _NON_DIGITS.sub("", search)
        if len(digits) >= 4:
            conditions.append(Client.phone.contains(digits, autoescape=True))
        stmt = stmt.where(or_(*conditions))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    clients = db.scalars(
        stmt.options(selectinload(Client.addresses))
        .order_by(func.lower(Client.name))
        .limit(limit)
        .offset(offset)
    ).all()
    items = [
        ClientListItem(
            id=c.id,
            name=c.name,
            phone=c.phone,
            email=c.email,
            is_active=c.is_active,
            default_address=c.addresses[0] if c.addresses else None,
            address_count=len(c.addresses),
        )
        for c in clients
    ]
    return items, total


def get_client(db: Session, company_id: uuid.UUID, client_id: uuid.UUID) -> Client:
    client = db.scalar(
        select(Client)
        .where(Client.id == client_id, Client.company_id == company_id)
        .options(selectinload(Client.addresses))
    )
    if client is None:
        raise NotFoundError("Cliente não encontrado.")
    return client


def create_client(db: Session, actor: User, data: ClientCreate) -> Client:
    client = Client(
        company_id=actor.company_id,
        **data.model_dump(exclude={"addresses"}),
    )
    db.add(client)
    db.flush()
    for address_data in data.addresses:
        _add_address(db, client, address_data)
    _ensure_one_default(db, client)
    _log(db, actor, AuditAction.CLIENT_CREATED, client.id)
    db.commit()
    return get_client(db, actor.company_id, client.id)


def update_client(db: Session, actor: User, client_id: uuid.UUID, data: ClientUpdate) -> Client:
    client = get_client(db, actor.company_id, client_id)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(client, field, value)

    if "is_active" in changes:
        action = AuditAction.CLIENT_ACTIVATED if client.is_active else AuditAction.CLIENT_ARCHIVED
        _log(db, actor, action, client.id)
    other_fields = sorted(set(changes) - {"is_active"})
    if other_fields:
        _log(db, actor, AuditAction.CLIENT_UPDATED, client.id, {"fields": other_fields})
    db.commit()
    return client


# ------------------------------------------------------------ endereços


def add_address(db: Session, actor: User, client_id: uuid.UUID, data: AddressIn) -> ClientAddress:
    client = get_client(db, actor.company_id, client_id)
    if len(client.addresses) >= MAX_ADDRESSES:
        raise ConflictError(
            f"Limite de {MAX_ADDRESSES} endereços por cliente.", code="ADDRESS_LIMIT"
        )
    address = _add_address(db, client, data)
    _ensure_one_default(db, client)
    _log(db, actor, AuditAction.CLIENT_UPDATED, client.id, {"address": "added"})
    db.commit()
    return address


def update_address(
    db: Session, actor: User, client_id: uuid.UUID, address_id: uuid.UUID, data: AddressUpdate
) -> ClientAddress:
    client = get_client(db, actor.company_id, client_id)
    address = _find_address(client, address_id)
    changes = data.model_dump(exclude_unset=True)
    make_default = changes.pop("is_default", None)
    for field, value in changes.items():
        setattr(address, field, value)
    if make_default:
        _set_default(db, client, address)
    _log(db, actor, AuditAction.CLIENT_UPDATED, client.id, {"address": "updated"})
    db.commit()
    return address


def delete_address(db: Session, actor: User, client_id: uuid.UUID, address_id: uuid.UUID) -> None:
    client = get_client(db, actor.company_id, client_id)
    address = _find_address(client, address_id)
    # Entregas guardam uma cópia do endereço (ADR-07): apagar aqui não
    # altera o histórico.
    client.addresses.remove(address)
    db.flush()
    _ensure_one_default(db, client)
    _log(db, actor, AuditAction.CLIENT_UPDATED, client.id, {"address": "removed"})
    db.commit()


# --------------------------------------------------------------- interno


def _add_address(db: Session, client: Client, data: AddressIn) -> ClientAddress:
    fields = data.model_dump()
    make_default = fields.pop("is_default")
    address = ClientAddress(company_id=client.company_id, client_id=client.id, **fields)
    client.addresses.append(address)
    db.flush()
    if make_default:
        _set_default(db, client, address)
    return address


def _set_default(db: Session, client: Client, address: ClientAddress) -> None:
    # Desmarca os outros ANTES de marcar este: o índice único parcial do banco
    # não aceita dois "principais" nem por um instante.
    db.execute(
        update(ClientAddress)
        .where(ClientAddress.client_id == client.id, ClientAddress.id != address.id)
        .values(is_default=False)
    )
    for other in client.addresses:
        if other.id != address.id:
            other.is_default = False
    address.is_default = True
    db.flush()


def _ensure_one_default(db: Session, client: Client) -> None:
    """Se há endereços e nenhum é principal, o primeiro vira principal."""
    if client.addresses and not any(a.is_default for a in client.addresses):
        _set_default(db, client, client.addresses[0])


def _find_address(client: Client, address_id: uuid.UUID) -> ClientAddress:
    # Procura DENTRO do cliente já validado: endereço de outro cliente (mesmo
    # da mesma empresa) com o id na URL não é encontrado.
    for address in client.addresses:
        if address.id == address_id:
            return address
    raise NotFoundError("Endereço não encontrado.")


def _log(
    db: Session,
    actor: User,
    action: AuditAction,
    client_id: uuid.UUID,
    details: dict | None = None,
) -> None:
    audit.record(
        db,
        action,
        company_id=actor.company_id,
        user_id=actor.id,
        resource_type="client",
        resource_id=client_id,
        details=details,
    )
