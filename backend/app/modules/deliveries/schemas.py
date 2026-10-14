import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from app.core.validators import normalize_name, normalize_phone
from app.modules.deliveries.models import FileKind, OccurrenceType, PaymentMethod
from app.modules.deliveries.state_machine import DeliveryStatus

# Dinheiro: decimal com 2 casas, nunca float (0.1 + 0.2 != 0.3 em float).
Money = Annotated[Decimal, Field(ge=0, le=99_999_999, decimal_places=2)]


class _PaymentRules(BaseModel):
    @model_validator(mode="after")
    def _change_rules(self) -> Self:
        change_for = getattr(self, "change_for", None)
        if change_for is None:
            return self
        if getattr(self, "payment_method", None) not in (None, PaymentMethod.CASH):
            raise ValueError("Troco só faz sentido para pagamento em dinheiro.")
        amount = getattr(self, "order_amount", None)
        if amount is not None and change_for < amount:
            raise ValueError("O troco deve ser para um valor maior ou igual ao do pedido.")
        return self


class _DeliveryInput(_PaymentRules):
    model_config = ConfigDict(extra="forbid")

    @field_validator(
        "notes", "recipient_name", "recipient_phone", mode="before", check_fields=False
    )
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("recipient_name", mode="after", check_fields=False)
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        return normalize_name(value) if value else None

    @field_validator("recipient_phone", mode="after", check_fields=False)
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value else None


class DeliveryCreate(_DeliveryInput):
    client_id: uuid.UUID
    client_address_id: uuid.UUID
    # Opcionais: por padrão usamos nome/telefone do cliente.
    recipient_name: str | None = Field(default=None, max_length=120)
    recipient_phone: str | None = Field(default=None, max_length=30)
    notes: str | None = Field(default=None, max_length=1000)
    order_amount: Money | None = None
    payment_method: PaymentMethod | None = None
    change_for: Money | None = None
    delivery_fee: Money | None = None
    expected_at: datetime | None = None
    # Já atribuir na criação (opcional).
    deliverer_id: uuid.UUID | None = None


class DeliveryUpdate(_DeliveryInput):
    """Campos editáveis. Status e entregador mudam só pelas ações."""

    client_address_id: uuid.UUID | None = None
    recipient_name: str | None = Field(default=None, max_length=120)
    recipient_phone: str | None = Field(default=None, max_length=30)
    notes: str | None = Field(default=None, max_length=1000)
    order_amount: Money | None = None
    payment_method: PaymentMethod | None = None
    change_for: Money | None = None
    delivery_fee: Money | None = None
    expected_at: datetime | None = None

    @model_validator(mode="after")
    def _address_not_null(self) -> Self:
        if "client_address_id" in self.model_fields_set and self.client_address_id is None:
            raise ValueError("O endereço não pode ficar vazio.")
        return self


class AssignIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deliverer_id: uuid.UUID


class CancelIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=3, max_length=300)

    @field_validator("reason", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


Latitude = Annotated[Decimal, Field(ge=-90, le=90, decimal_places=6)]
Longitude = Annotated[Decimal, Field(ge=-180, le=180, decimal_places=6)]


class _Located(BaseModel):
    """Localização do celular no momento da ação (opcional: GPS pode falhar)."""

    model_config = ConfigDict(extra="forbid")

    lat: Latitude | None = None
    lng: Longitude | None = None

    @model_validator(mode="after")
    def _both_or_none(self) -> Self:
        if (self.lat is None) != (self.lng is None):
            raise ValueError("Informe latitude e longitude juntas.")
        return self


class CompleteIn(_Located):
    received_by_name: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("received_by_name", "notes", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class IssueIn(_Located):
    type: OccurrenceType
    description: str | None = Field(default=None, max_length=500)
    # Foto opcional, enviada antes por POST .../files (kind=OCCURRENCE_PHOTO).
    photo_file_id: uuid.UUID | None = None

    @field_validator("description", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @model_validator(mode="after")
    def _describe_other(self) -> Self:
        if self.type == OccurrenceType.OTHER and not self.description:
            raise ValueError("Descreva a ocorrência.")
        return self


# ---------------------------------------------------------------- saída


class OccurrenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: OccurrenceType
    description: str | None
    lat: Decimal | None
    lng: Decimal | None
    created_at: datetime
    reporter: PersonOut | None


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: FileKind
    occurrence_id: uuid.UUID | None
    content_type: str
    size_bytes: int
    created_at: datetime

    @computed_field
    @property
    def url(self) -> str:
        # Download sempre pela API: a permissão é conferida a cada acesso.
        return f"/api/v1/files/{self.id}"


class ProofOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    received_by_name: str | None
    notes: str | None
    lat: Decimal | None
    lng: Decimal | None
    created_at: datetime


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str | None


class DeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    status: DeliveryStatus
    client_id: uuid.UUID
    client_address_id: uuid.UUID | None
    recipient_name: str
    recipient_phone: str | None
    zip_code: str | None
    street: str
    address_number: str
    complement: str | None
    neighborhood: str
    city: str
    state: str
    reference: str | None
    lat: Decimal | None
    lng: Decimal | None
    notes: str | None
    order_amount: Decimal | None
    payment_method: PaymentMethod | None
    change_for: Decimal | None
    delivery_fee: Decimal | None
    expected_at: datetime | None
    deliverer: PersonOut | None
    cancel_reason: str | None
    created_at: datetime
    assigned_at: datetime | None
    started_at: datetime | None
    delivered_at: datetime | None
    canceled_at: datetime | None
    occurrences: list[OccurrenceOut]
    proof: ProofOut | None
    files: list[FileOut]


class DeliveryPage(BaseModel):
    items: list[DeliveryOut]
    total: int
    limit: int
    offset: int


class DelivererOption(BaseModel):
    """Entregador disponível para atribuição, com a carga atual."""

    id: uuid.UUID
    name: str
    phone: str | None
    active_deliveries: int
