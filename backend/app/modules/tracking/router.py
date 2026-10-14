import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import TooManyRequestsError
from app.core.permissions import Permission
from app.core.rate_limit import RateLimiter
from app.modules.auth.dependencies import require_permission
from app.modules.tracking import service
from app.modules.tracking.schemas import (
    ActiveDelivererOut,
    LocationIn,
    LocationOut,
    TrackingStatusOut,
)
from app.modules.users.models import User

router = APIRouter(prefix="/tracking", tags=["tracking"])
me_router = APIRouter(prefix="/me", tags=["deliverer"])

DB = Annotated[Session, Depends(get_db)]
Sender = Annotated[User, Depends(require_permission(Permission.TRACKING_SEND))]
Viewer = Annotated[User, Depends(require_permission(Permission.TRACKING_READ))]

# O app envia a cada ~20 s; 12 por minuto já é folga de sobra.
# Protege o banco de um app com defeito (ou malicioso) mandando sem parar.
_location_limiter = RateLimiter(limit=12, window_seconds=60)


@me_router.get("/tracking", response_model=TrackingStatusOut)
def tracking_status(user: Sender, db: DB) -> TrackingStatusOut:
    """O app pergunta se deve ligar o GPS (há entrega em rota?)."""
    return TrackingStatusOut(tracking=service.is_tracking_active(db, user))


@me_router.post("/location", response_model=TrackingStatusOut)
def send_location(body: LocationIn, user: Sender, db: DB) -> TrackingStatusOut:
    if retry_after := _location_limiter.hit(str(user.id)):
        raise TooManyRequestsError(retry_after)
    # tracking=false: fora da operação, o ponto foi descartado e o app deve parar.
    return TrackingStatusOut(tracking=service.record_location(db, user, body))


@router.get("/deliverers", response_model=list[ActiveDelivererOut])
def active_deliverers(user: Viewer, db: DB) -> list[ActiveDelivererOut]:
    return service.active_deliverers(db, user.company_id)


@router.get("/deliveries/{delivery_id}/trail", response_model=list[LocationOut])
def delivery_trail(delivery_id: uuid.UUID, user: Viewer, db: DB) -> list[LocationOut]:
    return service.delivery_trail(db, user.company_id, delivery_id)
