"""Schemas de usuário.

Entrada e saída são classes SEPARADAS (proteção contra mass assignment):
- Entrada (UserCreate/UserUpdate) só aceita os campos listados; qualquer campo
  extra, como company_id ou password_hash, é rejeitado com 422 (extra="forbid").
- Saída (UserOut) só expõe o que pode ser exposto; password_hash nunca sai.
"""

import uuid
from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.permissions import Role
from app.core.validators import normalize_name, normalize_phone, validate_password_strength


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    role: Role
    is_active: bool
    locked_until: datetime | None
    last_login_at: datetime | None
    created_at: datetime


class UserPage(BaseModel):
    items: list[UserOut]
    total: int
    limit: int
    offset: int


class _UserInput(BaseModel):
    # Sem str_strip_whitespace: isso cortaria espaços da SENHA, e o login
    # (que recebe a senha intacta) deixaria de bater. Normalizamos campo a campo.
    model_config = ConfigDict(extra="forbid")

    @field_validator("name", mode="after", check_fields=False)
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        return normalize_name(value) if value is not None else None

    @field_validator("email", "phone", mode="before", check_fields=False)
    @classmethod
    def _empty_to_none(cls, value: object) -> object:
        # Formulários mandam "" para campo vazio; tratamos como "não informado".
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("email", mode="after", check_fields=False)
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return value.lower() if value else None

    @field_validator("phone", mode="after", check_fields=False)
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return normalize_phone(value) if value else None


class UserCreate(_UserInput):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    role: Role
    password: str = Field(max_length=128)

    @field_validator("password")
    @classmethod
    def _password(cls, value: str) -> str:
        return validate_password_strength(value)

    @model_validator(mode="after")
    def _email_or_phone(self) -> Self:
        if not self.email and not self.phone:
            raise ValueError("Informe e-mail ou telefone.")
        return self


class UserUpdate(_UserInput):
    """PATCH: só os campos enviados são alterados.

    email/phone aceitam null (remover); name/role/is_active não.
    """

    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    role: Role | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _no_null_required_fields(self) -> Self:
        for field in ("name", "role", "is_active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"O campo '{field}' não pode ser vazio.")
        return self


class PasswordResetIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def _password(cls, value: str) -> str:
        return validate_password_strength(value)
