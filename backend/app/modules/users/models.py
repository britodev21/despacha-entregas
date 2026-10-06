import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.core.permissions import Role
from app.modules.companies.models import Company


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Pessoa que acessa o sistema: admin, operador ou entregador (ver ADR-06)."""

    __tablename__ = "users"
    __table_args__ = (
        # Login por e-mail OU telefone: pelo menos um precisa existir.
        CheckConstraint("email IS NOT NULL OR phone IS NOT NULL", name="email_or_phone"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    # Únicos no sistema inteiro: o login não pede a empresa.
    # Sempre salvos normalizados (e-mail minúsculo, telefone só dígitos).
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    phone: Mapped[str | None] = mapped_column(String(15), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    # native_enum=False: VARCHAR + CHECK em vez de ENUM do PostgreSQL,
    # que é difícil de alterar em migrations futuras.
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="role", native_enum=False, length=16, create_constraint=True)
    )
    is_active: Mapped[bool] = mapped_column(server_default=true())

    # Proteção contra força bruta (ver auth/service.py)
    failed_login_count: Mapped[int] = mapped_column(server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Access tokens emitidos antes desta data são recusados.
    password_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # lazy="joined": carrega a empresa na mesma query (precisamos de
    # company.is_active em toda requisição autenticada).
    company: Mapped[Company] = relationship(lazy="joined")
