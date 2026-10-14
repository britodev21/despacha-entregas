import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class AttentionItem(BaseModel):
    """Entrega que precisa de ação agora, com o motivo."""

    delivery_id: uuid.UUID
    number: int
    recipient_name: str
    neighborhood: str
    status: str
    reason: Literal["ISSUE", "LATE", "WAITING"]
    since: datetime  # ocorrência / previsão estourada / criação
    deliverer_name: str | None


class DashboardSummary(BaseModel):
    today: date  # no fuso da empresa
    created_today: int
    # Mesmo horário de ontem: comparação justa (dia parcial × dia parcial).
    created_yesterday_until_now: int
    delivered_today: int
    canceled_today: int
    pending: int
    assigned: int
    in_route: int
    issues: int
    active_deliverers: int
    avg_delivery_minutes_today: int | None
    attention: list[AttentionItem]


class DelivererReportRow(BaseModel):
    deliverer_id: uuid.UUID
    name: str
    delivered: int
    canceled: int
    issues: int
    fees_total: Decimal
    avg_minutes: int | None  # da saída até a entrega
