import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Permission
from app.modules.auth.dependencies import require_permission
from app.modules.deliveries import service
from app.modules.deliveries.models import Delivery
from app.modules.deliveries.schemas import (
    AssignIn,
    CancelIn,
    DelivererOption,
    DeliveryCreate,
    DeliveryOut,
    DeliveryPage,
    DeliveryUpdate,
)
from app.modules.deliveries.state_machine import DeliveryStatus
from app.modules.users.models import User

router = APIRouter(prefix="/deliveries", tags=["deliveries"])
deliverers_router = APIRouter(prefix="/deliverers", tags=["deliveries"])

DB = Annotated[Session, Depends(get_db)]
Manager = Annotated[User, Depends(require_permission(Permission.DELIVERIES_MANAGE))]
DeliveryId = Annotated[uuid.UUID, "id da entrega"]


@router.get("", response_model=DeliveryPage)
def list_deliveries(
    user: Manager,
    db: DB,
    status_: Annotated[list[DeliveryStatus] | None, Query(alias="status")] = None,
    deliverer_id: uuid.UUID | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> DeliveryPage:
    items, total = service.list_deliveries(
        db,
        user.company,
        statuses=status_,
        deliverer_id=deliverer_id,
        created_from=created_from,
        created_to=created_to,
        search=search.strip() if search else None,
        limit=limit,
        offset=offset,
    )
    return DeliveryPage(
        items=[DeliveryOut.model_validate(d) for d in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=DeliveryOut, status_code=status.HTTP_201_CREATED)
def create_delivery(body: DeliveryCreate, user: Manager, db: DB) -> Delivery:
    return service.create_delivery(db, user, body)


@router.get("/{delivery_id}", response_model=DeliveryOut)
def get_delivery(delivery_id: DeliveryId, user: Manager, db: DB) -> Delivery:
    return service.get_delivery(db, user.company_id, delivery_id)


@router.patch("/{delivery_id}", response_model=DeliveryOut)
def update_delivery(
    delivery_id: DeliveryId, body: DeliveryUpdate, user: Manager, db: DB
) -> Delivery:
    return service.update_delivery(db, user, delivery_id, body)


# ---- Ações: cada uma é um passo explícito da máquina de estados.


@router.post("/{delivery_id}/assign", response_model=DeliveryOut)
def assign(delivery_id: DeliveryId, body: AssignIn, user: Manager, db: DB) -> Delivery:
    return service.assign(db, user, delivery_id, body.deliverer_id)


@router.post("/{delivery_id}/unassign", response_model=DeliveryOut)
def unassign(delivery_id: DeliveryId, user: Manager, db: DB) -> Delivery:
    return service.unassign(db, user, delivery_id)


@router.post("/{delivery_id}/start", response_model=DeliveryOut)
def start(delivery_id: DeliveryId, user: Manager, db: DB) -> Delivery:
    return service.start(db, user, delivery_id)


@router.post("/{delivery_id}/complete", response_model=DeliveryOut)
def complete(delivery_id: DeliveryId, user: Manager, db: DB) -> Delivery:
    return service.complete(db, user, delivery_id)


@router.post("/{delivery_id}/cancel", response_model=DeliveryOut)
def cancel(delivery_id: DeliveryId, body: CancelIn, user: Manager, db: DB) -> Delivery:
    return service.cancel(db, user, delivery_id, body.reason)


@deliverers_router.get("", response_model=list[DelivererOption])
def list_deliverers(user: Manager, db: DB) -> list[DelivererOption]:
    return service.list_deliverers(db, user.company_id)
