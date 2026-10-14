"""Rastreamento durante a operação (ADR-08).

Regra de privacidade aplicada AQUI, no servidor: posição só é aceita se o
entregador tem entrega em rota ou em ocorrência. Fora da operação o ponto é
descartado, mesmo que o app envie.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, exists, func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.core.permissions import Role
from app.modules.deliveries.models import Delivery
from app.modules.deliveries.state_machine import DeliveryStatus
from app.modules.tracking.models import DelivererLocation
from app.modules.tracking.schemas import (
    ActiveDelivererOut,
    CurrentDeliveryOut,
    LocationIn,
    LocationOut,
)
from app.modules.users.models import User

S = DeliveryStatus
TRACKABLE = (S.IN_ROUTE, S.ISSUE)
OPERATING = (S.ASSIGNED, S.IN_ROUTE, S.ISSUE)

# Relógio do celular pode estar errado; fora desta janela usamos o do servidor.
_MAX_FUTURE = timedelta(minutes=2)
_MAX_PAST = timedelta(hours=1)


def _now() -> datetime:
    return datetime.now(UTC)


def is_tracking_active(db: Session, user: User) -> bool:
    return bool(
        db.scalar(
            select(
                exists().where(
                    Delivery.company_id == user.company_id,
                    Delivery.deliverer_id == user.id,
                    Delivery.status.in_(TRACKABLE),
                )
            )
        )
    )


def record_location(db: Session, user: User, data: LocationIn) -> bool:
    """Grava a posição se o entregador está em operação. Retorna se gravou."""
    if not is_tracking_active(db, user):
        return False
    now = _now()
    recorded = data.recorded_at or now
    if recorded.tzinfo is None:
        recorded = recorded.replace(tzinfo=UTC)
    if not (now - _MAX_PAST <= recorded <= now + _MAX_FUTURE):
        recorded = now
    db.add(
        DelivererLocation(
            company_id=user.company_id,
            user_id=user.id,
            lat=data.lat,
            lng=data.lng,
            accuracy_m=data.accuracy_m,
            recorded_at=recorded,
        )
    )
    db.commit()
    return True


def active_deliverers(db: Session, company_id: uuid.UUID) -> list[ActiveDelivererOut]:
    """Entregadores com entrega atribuída, em rota ou em ocorrência, com a
    última posição conhecida e a entrega atual."""
    deliveries = db.scalars(
        select(Delivery)
        .where(Delivery.company_id == company_id, Delivery.status.in_(OPERATING))
        .order_by(Delivery.started_at.asc().nulls_last(), Delivery.created_at)
    ).all()
    if not deliveries:
        return []

    by_user: dict[uuid.UUID, list[Delivery]] = {}
    for delivery in deliveries:
        by_user.setdefault(delivery.deliverer_id, []).append(delivery)

    users = db.scalars(
        select(User)
        .where(
            User.id.in_(by_user),
            User.company_id == company_id,
            User.role == Role.DELIVERER,
        )
        .order_by(User.name)
    ).all()

    # DISTINCT ON: a linha mais recente de cada entregador numa só consulta.
    latest = {
        loc.user_id: loc
        for loc in db.scalars(
            select(DelivererLocation)
            .where(
                DelivererLocation.company_id == company_id,
                DelivererLocation.user_id.in_(by_user),
            )
            .ext(distinct_on(DelivererLocation.user_id))
            .order_by(DelivererLocation.user_id, DelivererLocation.recorded_at.desc())
        )
    }

    result = []
    for user in users:
        mine = by_user[user.id]
        priority = {S.IN_ROUTE: 0, S.ISSUE: 1, S.ASSIGNED: 2}
        current = min(mine, key=lambda d: priority[d.status])
        location = latest.get(user.id)
        result.append(
            ActiveDelivererOut(
                id=user.id,
                name=user.name,
                phone=user.phone,
                in_route=sum(d.status == S.IN_ROUTE for d in mine),
                issues=sum(d.status == S.ISSUE for d in mine),
                assigned=sum(d.status == S.ASSIGNED for d in mine),
                current_delivery=CurrentDeliveryOut(
                    id=current.id,
                    number=current.number,
                    recipient_name=current.recipient_name,
                    neighborhood=current.neighborhood,
                    status=current.status,
                ),
                last_location=LocationOut.model_validate(location) if location else None,
            )
        )
    return result


def delivery_trail(db: Session, company_id: uuid.UUID, delivery_id: uuid.UUID) -> list[LocationOut]:
    """Trajeto do entregador durante uma entrega (do início ao fim)."""
    delivery = db.scalar(
        select(Delivery).where(Delivery.id == delivery_id, Delivery.company_id == company_id)
    )
    if delivery is None:
        raise NotFoundError("Entrega não encontrada.")
    if delivery.deliverer_id is None or delivery.started_at is None:
        return []
    end = delivery.delivered_at or delivery.canceled_at or _now()
    points = db.scalars(
        select(DelivererLocation)
        .where(
            DelivererLocation.company_id == company_id,
            DelivererLocation.user_id == delivery.deliverer_id,
            DelivererLocation.recorded_at >= delivery.started_at,
            DelivererLocation.recorded_at <= end,
        )
        .order_by(DelivererLocation.recorded_at)
        .limit(1000)
    ).all()
    return [LocationOut.model_validate(p) for p in points]


def purge_old_locations(db: Session, days: int) -> int:
    """Apaga posições mais antigas que `days` dias (todas as empresas)."""
    cutoff = _now() - timedelta(days=days)
    result = db.execute(delete(DelivererLocation).where(DelivererLocation.recorded_at < cutoff))
    db.commit()
    return result.rowcount or 0


def count_locations(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(DelivererLocation)) or 0
