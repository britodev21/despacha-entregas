import uuid
from datetime import datetime
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.validators import (
    normalize_document,
    normalize_name,
    normalize_phone,
    normalize_state,
    normalize_zip_code,
)


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        return value.strip() or None
    return value


# ------------------------------------------------------------- endereço


class AddressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str | None
    zip_code: str | None
    street: str
    number: str
    complement: str | None
    neighborhood: str
    city: str
    state: str
    reference: str | None
    lat: Decimal | None
    lng: Decimal | None
    is_default: bool


class _AddressFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator(
        "label", "zip_code", "complement", "reference", mode="before", check_fields=False
    )
    @classmethod
    def _optional_text(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("street", "number", "neighborhood", "city", mode="before", check_fields=False)
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("zip_code", mode="after", check_fields=False)
    @classmethod
    def _zip(cls, value: str | None) -> str | None:
        return normalize_zip_code(value) if value else None

    @field_validator("state", mode="after", check_fields=False)
    @classmethod
    def _state(cls, value: str | None) -> str | None:
        return normalize_state(value) if value else None


class AddressIn(_AddressFields):
    label: str | None = Field(default=None, max_length=40)
    zip_code: str | None = Field(default=None, max_length=9)
    street: str = Field(min_length=1, max_length=160)
    number: str = Field(min_length=1, max_length=20)
    complement: str | None = Field(default=None, max_length=80)
    neighborhood: str = Field(min_length=1, max_length=80)
    city: str = Field(min_length=1, max_length=80)
    state: str = Field(min_length=2, max_length=2)
    reference: str | None = Field(default=None, max_length=160)
    lat: Decimal | None = Field(default=None, ge=-90, le=90, decimal_places=6)
    lng: Decimal | None = Field(default=None, ge=-180, le=180, decimal_places=6)
    is_default: bool = False


class AddressUpdate(_AddressFields):
    label: str | None = Field(default=None, max_length=40)
    zip_code: str | None = Field(default=None, max_length=9)
    street: str | None = Field(default=None, min_length=1, max_length=160)
    number: str | None = Field(default=None, min_length=1, max_length=20)
    complement: str | None = Field(default=None, max_length=80)
    neighborhood: str | None = Field(default=None, min_length=1, max_length=80)
    city: str | None = Field(default=None, min_length=1, max_length=80)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    reference: str | None = Field(default=None, max_length=160)
    lat: Decimal | None = Field(default=None, ge=-90, le=90, decimal_places=6)
    lng: Decimal | None = Field(default=None, ge=-180, le=180, decimal_places=6)
    is_default: bool | None = None

    @model_validator(mode="after")
    def _required_stay_required(self) -> Self:
        for field in ("street", "number", "neighborhood", "city", "state", "is_default"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"O campo '{field}' não pode ser vazio.")
        return self


# -------------------------------------------------------------- cliente


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    document: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    addresses: list[AddressOut]


class ClientListItem(BaseModel):
    """Versão enxuta para listas e busca: sem documento (dado sensível)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    is_active: bool
    default_address: AddressOut | None
    address_count: int


class ClientPage(BaseModel):
    items: list[ClientListItem]
    total: int
    limit: int
    offset: int


class _ClientFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("email", "phone", "document", "notes", mode="before", check_fields=False)
    @classmethod
    def _optional_text(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("name", mode="after", check_fields=False)
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        return normalize_name(value) if value is not None else None

    @field_validator("email", mode="after", check_fields=False)
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return value.lower() if value else None

    @field_validator("phone", mode="after", check_fields=False)
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value else None

    @field_validator("document", mode="after", check_fields=False)
    @classmethod
    def _document(cls, value: str | None) -> str | None:
        return normalize_document(value) if value else None


class ClientCreate(_ClientFields):
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    document: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=1000)
    # Endereços já no cadastro: o operador cria cliente + endereço de uma vez.
    addresses: list[AddressIn] = Field(default_factory=list, max_length=10)


class ClientUpdate(_ClientFields):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    document: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None

    @model_validator(mode="after")
    def _required_stay_required(self) -> Self:
        for field in ("name", "is_active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"O campo '{field}' não pode ser vazio.")
        return self
