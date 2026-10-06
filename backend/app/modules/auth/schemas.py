import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.permissions import ROLE_PERMISSIONS, Role
from app.core.validators import validate_password_strength
from app.modules.users.models import User


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    identifier: str = Field(min_length=1, max_length=254, description="E-mail ou telefone")
    # No login não aplicamos regra de força (senhas antigas continuam valendo),
    # só o teto de tamanho, que protege o Argon2 contra entradas gigantes.
    password: str = Field(min_length=1, max_length=128)


class MeOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    role: Role
    company_id: uuid.UUID
    company_name: str
    # O frontend usa para mostrar/esconder telas. Isso é só UX: o backend
    # verifica a permissão de novo em toda rota.
    permissions: list[str]

    @classmethod
    def from_user(cls, user: User) -> MeOut:
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            role=user.role,
            company_id=user.company_id,
            company_name=user.company.name,
            permissions=sorted(ROLE_PERMISSIONS[user.role]),
        )


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 (tipo do token, não segredo)
    expires_in: int
    user: MeOut


class ChangePasswordIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strength(cls, value: str) -> str:
        return validate_password_strength(value)
