"""Regras de negócio das entregas.

- Toda consulta é filtrada pelo company_id de quem pede (ADR-01).
- Toda mudança de status passa por `_transition`, que consulta a máquina de
  estados e trava a linha (SELECT ... FOR UPDATE) para evitar corrida, ex.:
  operador cancela no mesmo instante em que o entregador finaliza.
"""

import re
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError, ConflictError, NotFoundError
from app.core.permissions import Role
from app.modules.audit import service as audit
from app.modules.audit.models import AuditAction
from app.modules.clients.models import Client, ClientAddress
from app.modules.companies.models import Company
from app.modules.deliveries.models import Delivery, PaymentMethod
from app.modules.deliveries.schemas import DelivererOption, DeliveryCreate, DeliveryUpdate
from app.modules.deliveries.state_machine import (
    ADDRESS_EDITABLE,
    FINAL_STATUSES,
    DeliveryStatus,
    can_transition,
)
from app.modules.users.models import User

S = DeliveryStatus
RESOURCE = "delivery"
_NON_DIGITS = re.compile(r"\D")

_SNAPSHOT_FIELDS = (
    "zip_code",
    "street",
    "complement",
    "neighborhood",
    "city",
    "state",
    "reference",
    "lat",
    "lng",
)


def _now() -> datetime:
    return datetime.now(UTC)


# --------------------------------------------------------------- consulta


def list_deliveries(
    db: Session,
    company: Company,
    *,
    statuses: list[DeliveryStatus] | None = None,
    deliverer_id: uuid.UUID | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Delivery], int]:
    stmt = select(Delivery).where(Delivery.company_id == company.id)
    if statuses:
        stmt = stmt.where(Delivery.status.in_(statuses))
    if deliverer_id:
        stmt = stmt.where(Delivery.deliverer_id == deliverer_id)
    # "Hoje" depende do fuso da empresa: 00:00 em São Paulo é 03:00 UTC.
    tz = ZoneInfo(company.timezone)
    if created_from:
        stmt = stmt.where(Delivery.created_at >= datetime.combine(created_from, time.min, tz))
    if created_to:
        next_day = datetime.combine(created_to + timedelta(days=1), time.min, tz)
        stmt = stmt.where(Delivery.created_at < next_day)
    if search:
        term = search.lstrip("#")
        conditions = [Delivery.recipient_name.icontains(search, autoescape=True)]
        if term.isdigit():
            conditions.append(Delivery.number == int(term))
        digits = _NON_DIGITS.sub("", search)
        if len(digits) >= 4:
            conditions.append(Delivery.recipient_phone.contains(digits, autoescape=True))
        stmt = stmt.where(or_(*conditions))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.order_by(Delivery.created_at.desc()).limit(limit).offset(offset)).all()
    return list(items), total


def get_delivery(
    db: Session, company_id: uuid.UUID, delivery_id: uuid.UUID, *, for_update: bool = False
) -> Delivery:
    stmt = select(Delivery).where(Delivery.id == delivery_id, Delivery.company_id == company_id)
    if for_update:
        stmt = stmt.with_for_update(of=Delivery)
    delivery = db.scalar(stmt)
    if delivery is None:
        raise NotFoundError("Entrega não encontrada.")
    return delivery


def list_deliverers(db: Session, company_id: uuid.UUID) -> list[DelivererOption]:
    """Entregadores ativos, com quantas entregas estão com cada um agora."""
    active = (
        select(Delivery.deliverer_id, func.count().label("total"))
        .where(
            Delivery.company_id == company_id,
            Delivery.status.in_([S.ASSIGNED, S.IN_ROUTE, S.ISSUE]),
        )
        .group_by(Delivery.deliverer_id)
        .subquery()
    )
    rows = db.execute(
        select(User.id, User.name, User.phone, func.coalesce(active.c.total, 0))
        .outerjoin(active, active.c.deliverer_id == User.id)
        .where(
            User.company_id == company_id,
            User.role == Role.DELIVERER,
            User.is_active.is_(True),
        )
        .order_by(User.name)
    ).all()
    return [DelivererOption(id=r[0], name=r[1], phone=r[2], active_deliveries=r[3]) for r in rows]


# ---------------------------------------------------------------- criação


def create_delivery(db: Session, actor: User, data: DeliveryCreate) -> Delivery:
    client, address = _client_and_address(
        db, actor.company_id, data.client_id, data.client_address_id
    )
    if not client.is_active:
        raise ConflictError(
            "Cliente arquivado. Reative-o para criar entregas.", code="CLIENT_ARCHIVED"
        )

    delivery = Delivery(
        company_id=actor.company_id,
        number=_next_number(db, actor.company_id),
        client_id=client.id,
        client_address_id=address.id,
        recipient_name=data.recipient_name or client.name,
        recipient_phone=data.recipient_phone or client.phone,
        notes=data.notes,
        order_amount=data.order_amount,
        payment_method=data.payment_method,
        change_for=data.change_for,
        delivery_fee=data.delivery_fee,
        expected_at=data.expected_at,
        status=S.PENDING,
        created_by=actor.id,
    )
    _copy_address(delivery, address)
    db.add(delivery)
    db.flush()
    _log(db, actor, AuditAction.DELIVERY_CREATED, delivery, {"number": delivery.number})

    if data.deliverer_id:
        deliverer = _deliverer(db, actor.company_id, data.deliverer_id)
        _apply(db, actor, delivery, S.ASSIGNED, deliverer=deliverer)

    db.commit()
    return delivery


def _next_number(db: Session, company_id: uuid.UUID) -> int:
    # Incremento atômico: o UPDATE trava a linha da empresa até o commit.
    # Duas entregas criadas no mesmo instante nunca recebem o mesmo número.
    return db.execute(
        update(Company)
        .where(Company.id == company_id)
        .values(next_delivery_number=Company.next_delivery_number + 1)
        .returning(Company.next_delivery_number - 1)
    ).scalar_one()


# ----------------------------------------------------------------- edição


def update_delivery(
    db: Session, actor: User, delivery_id: uuid.UUID, data: DeliveryUpdate
) -> Delivery:
    delivery = get_delivery(db, actor.company_id, delivery_id, for_update=True)
    if delivery.status in FINAL_STATUSES:
        raise ConflictError("Entrega finalizada não pode ser editada.", code="DELIVERY_FINAL")

    changes = data.model_dump(exclude_unset=True)
    address_id = changes.pop("client_address_id", None)
    if address_id and address_id != delivery.client_address_id:
        if delivery.status not in ADDRESS_EDITABLE:
            raise ConflictError(
                "O endereço não pode mudar com a entrega em rota.", code="ADDRESS_LOCKED"
            )
        _, address = _client_and_address(db, actor.company_id, delivery.client_id, address_id)
        delivery.client_address_id = address.id
        _copy_address(delivery, address)
        changes["address"] = True

    for field, value in changes.items():
        if field != "address":
            setattr(delivery, field, value)
    _validate_payment(delivery)

    if changes:
        _log(db, actor, AuditAction.DELIVERY_UPDATED, delivery, {"fields": sorted(changes)})
    db.commit()
    return delivery


# ----------------------------------------------------------------- ações


def assign(db: Session, actor: User, delivery_id: uuid.UUID, deliverer_id: uuid.UUID) -> Delivery:
    delivery = get_delivery(db, actor.company_id, delivery_id, for_update=True)
    deliverer = _deliverer(db, actor.company_id, deliverer_id)
    if delivery.deliverer_id == deliverer.id and delivery.status == S.ASSIGNED:
        return delivery  # idempotente
    _transition(db, actor, delivery, S.ASSIGNED, deliverer=deliverer)
    db.commit()
    return delivery


def unassign(db: Session, actor: User, delivery_id: uuid.UUID) -> Delivery:
    delivery = get_delivery(db, actor.company_id, delivery_id, for_update=True)
    _transition(db, actor, delivery, S.PENDING)
    db.commit()
    return delivery


def start(db: Session, actor: User, delivery_id: uuid.UUID) -> Delivery:
    delivery = get_delivery(db, actor.company_id, delivery_id, for_update=True)
    _transition(db, actor, delivery, S.IN_ROUTE)
    db.commit()
    return delivery


def complete(db: Session, actor: User, delivery_id: uuid.UUID) -> Delivery:
    delivery = get_delivery(db, actor.company_id, delivery_id, for_update=True)
    _transition(db, actor, delivery, S.DELIVERED)
    db.commit()
    return delivery


def cancel(db: Session, actor: User, delivery_id: uuid.UUID, reason: str) -> Delivery:
    delivery = get_delivery(db, actor.company_id, delivery_id, for_update=True)
    _transition(db, actor, delivery, S.CANCELED, reason=reason)
    db.commit()
    return delivery


# --------------------------------------------------------------- interno


def _transition(
    db: Session,
    actor: User,
    delivery: Delivery,
    target: DeliveryStatus,
    *,
    deliverer: User | None = None,
    reason: str | None = None,
) -> None:
    if not can_transition(delivery.status, target):
        raise ConflictError(
            f"Não é possível mudar de {delivery.status} para {target}.",
            code="INVALID_TRANSITION",
        )
    if target == S.IN_ROUTE and delivery.deliverer_id is None:
        raise ConflictError("Atribua um entregador antes de iniciar.", code="NO_DELIVERER")
    _apply(db, actor, delivery, target, deliverer=deliverer, reason=reason)


def _apply(
    db: Session,
    actor: User,
    delivery: Delivery,
    target: DeliveryStatus,
    *,
    deliverer: User | None = None,
    reason: str | None = None,
) -> None:
    """Aplica a mudança de status e os efeitos na linha do tempo."""
    now = _now()
    previous_status = delivery.status
    previous_deliverer = delivery.deliverer_id

    if target == S.ASSIGNED:
        delivery.deliverer_id = deliverer.id
        delivery.assigned_at = now
    elif target == S.PENDING:
        delivery.deliverer_id = None
        delivery.assigned_at = None
        delivery.started_at = None
    elif target == S.IN_ROUTE:
        delivery.started_at = delivery.started_at or now
    elif target == S.DELIVERED:
        delivery.delivered_at = now
    elif target == S.CANCELED:
        delivery.canceled_at = now
        delivery.cancel_reason = reason
    delivery.status = target
    db.flush()

    if previous_deliverer != delivery.deliverer_id:
        _log(
            db,
            actor,
            AuditAction.DELIVERY_DELIVERER_CHANGED,
            delivery,
            {
                "from": str(previous_deliverer) if previous_deliverer else None,
                "to": str(delivery.deliverer_id) if delivery.deliverer_id else None,
            },
        )
    if previous_status != target:
        details = {"from": previous_status, "to": target}
        if reason:
            details["reason"] = reason
        _log(db, actor, AuditAction.DELIVERY_STATUS_CHANGED, delivery, details)


def _client_and_address(
    db: Session, company_id: uuid.UUID, client_id: uuid.UUID, address_id: uuid.UUID
) -> tuple[Client, ClientAddress]:
    client = db.scalar(
        select(Client).where(Client.id == client_id, Client.company_id == company_id)
    )
    if client is None:
        raise NotFoundError("Cliente não encontrado.")
    address = db.scalar(
        select(ClientAddress).where(
            ClientAddress.id == address_id,
            ClientAddress.client_id == client.id,
            ClientAddress.company_id == company_id,
        )
    )
    if address is None:
        raise NotFoundError("Endereço não encontrado para este cliente.")
    return client, address


def _deliverer(db: Session, company_id: uuid.UUID, user_id: uuid.UUID) -> User:
    user = db.scalar(select(User).where(User.id == user_id, User.company_id == company_id))
    if user is None or user.role != Role.DELIVERER:
        raise NotFoundError("Entregador não encontrado.")
    if not user.is_active:
        raise ConflictError("Este entregador está desativado.", code="DELIVERER_INACTIVE")
    return user


def _copy_address(delivery: Delivery, address: ClientAddress) -> None:
    for field in _SNAPSHOT_FIELDS:
        setattr(delivery, field, getattr(address, field))
    delivery.address_number = address.number


def _validate_payment(delivery: Delivery) -> None:
    """Revalida o troco com os valores JÁ combinados (edição parcial)."""
    if delivery.change_for is None:
        return
    if delivery.payment_method not in (None, PaymentMethod.CASH):
        raise AppError("Troco só faz sentido para pagamento em dinheiro.", code="INVALID_CHANGE")
    if delivery.order_amount is not None and delivery.change_for < delivery.order_amount:
        raise AppError(
            "O troco deve ser para um valor maior ou igual ao do pedido.", code="INVALID_CHANGE"
        )


def _log(
    db: Session, actor: User, action: AuditAction, delivery: Delivery, details: dict | None = None
) -> None:
    audit.record(
        db,
        action,
        company_id=delivery.company_id,
        user_id=actor.id,
        resource_type=RESOURCE,
        resource_id=delivery.id,
        details=details,
    )
