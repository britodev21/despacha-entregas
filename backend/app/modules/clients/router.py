import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Permission
from app.modules.auth.dependencies import require_permission
from app.modules.clients import service
from app.modules.clients.models import Client, ClientAddress
from app.modules.clients.schemas import (
    AddressIn,
    AddressOut,
    AddressUpdate,
    ClientCreate,
    ClientOut,
    ClientPage,
    ClientUpdate,
)
from app.modules.users.models import User

router = APIRouter(prefix="/clients", tags=["clients"])

DB = Annotated[Session, Depends(get_db)]
Operator = Annotated[User, Depends(require_permission(Permission.CLIENTS_MANAGE))]


@router.get("", response_model=ClientPage)
def list_clients(
    user: Operator,
    db: DB,
    search: Annotated[str | None, Query(max_length=100)] = None,
    include_inactive: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ClientPage:
    items, total = service.list_clients(
        db,
        user.company_id,
        search=search.strip() if search else None,
        include_inactive=include_inactive,
        limit=limit,
        offset=offset,
    )
    return ClientPage(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(body: ClientCreate, user: Operator, db: DB) -> Client:
    return service.create_client(db, user, body)


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: uuid.UUID, user: Operator, db: DB) -> Client:
    return service.get_client(db, user.company_id, client_id)


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(client_id: uuid.UUID, body: ClientUpdate, user: Operator, db: DB) -> Client:
    return service.update_client(db, user, client_id, body)


@router.post(
    "/{client_id}/addresses", response_model=AddressOut, status_code=status.HTTP_201_CREATED
)
def add_address(client_id: uuid.UUID, body: AddressIn, user: Operator, db: DB) -> ClientAddress:
    return service.add_address(db, user, client_id, body)


@router.patch("/{client_id}/addresses/{address_id}", response_model=AddressOut)
def update_address(
    client_id: uuid.UUID, address_id: uuid.UUID, body: AddressUpdate, user: Operator, db: DB
) -> ClientAddress:
    return service.update_address(db, user, client_id, address_id, body)


@router.delete("/{client_id}/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(client_id: uuid.UUID, address_id: uuid.UUID, user: Operator, db: DB) -> None:
    service.delete_address(db, user, client_id, address_id)
