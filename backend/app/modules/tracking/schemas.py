import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Latitude = Annotated[Decimal, Field(ge=-90, le=90, decimal_places=6)]
Longitude = Annotated[Decimal, Field(ge=-180, le=180, decimal_places=6)]


class LocationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: Latitude
    lng: Longitude
    accuracy_m: Annotated[Decimal, Field(ge=0, le=100_000, decimal_places=1)] | None = None
    # Horário da medição no celular. Opcional: sem ele, vale o do servidor.
    recorded_at: datetime | None = None


class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lat: Decimal
    lng: Decimal
    accuracy_m: Decimal | None
    recorded_at: datetime


class CurrentDeliveryOut(BaseModel):
    id: uuid.UUID
    number: int
    recipient_name: str
    neighborhood: str
    status: str


class ActiveDelivererOut(BaseModel):
    """Entregador em operação, para o mapa do operador."""

    id: uuid.UUID
    name: str
    phone: str | None
    in_route: int
    issues: int
    assigned: int
    current_delivery: CurrentDeliveryOut | None
    last_location: LocationOut | None


class TrackingStatusOut(BaseModel):
    """Resposta ao entregador: o app sabe se deve continuar enviando."""

    tracking: bool
