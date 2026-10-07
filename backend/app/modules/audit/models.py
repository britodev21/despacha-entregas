import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, Identity, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AuditAction(StrEnum):
    AUTH_LOGIN_SUCCEEDED = "auth.login_succeeded"
    AUTH_LOGIN_FAILED = "auth.login_failed"
    AUTH_LOGIN_BLOCKED = "auth.login_blocked"
    AUTH_ACCOUNT_LOCKED = "auth.account_locked"
    AUTH_LOGOUT = "auth.logout"
    AUTH_REFRESH_REUSE_DETECTED = "auth.refresh_reuse_detected"
    AUTH_PASSWORD_CHANGED = "auth.password_changed"  # noqa: S105 (nome de ação, não senha)
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_ROLE_CHANGED = "user.role_changed"
    USER_DEACTIVATED = "user.deactivated"
    USER_ACTIVATED = "user.activated"
    USER_PASSWORD_RESET = "user.password_reset"  # noqa: S105 (nome de ação, não senha)
    CLIENT_CREATED = "client.created"
    CLIENT_UPDATED = "client.updated"
    CLIENT_ARCHIVED = "client.archived"
    CLIENT_ACTIVATED = "client.activated"
    DELIVERY_CREATED = "delivery.created"
    DELIVERY_UPDATED = "delivery.updated"
    DELIVERY_STATUS_CHANGED = "delivery.status_changed"
    DELIVERY_DELIVERER_CHANGED = "delivery.deliverer_changed"
    DELIVERY_ISSUE_REPORTED = "delivery.issue_reported"


class AuditLog(Base):
    """Registro append-only de ações relevantes (ver ADR-13).

    Sem chaves estrangeiras de propósito: o log precisa sobreviver mesmo que
    o registro referenciado mude ou deixe de existir. O usuário de banco da
    aplicação não tem UPDATE/DELETE nesta tabela (ver migration).
    """

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_company_id_created_at", "company_id", "created_at"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    company_id: Mapped[uuid.UUID | None]
    user_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    action: Mapped[str] = mapped_column(String(64))
    resource_type: Mapped[str | None] = mapped_column(String(32))
    resource_id: Mapped[str | None] = mapped_column(String(64))
    ip: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    # Contexto extra. NUNCA colocar senhas, tokens ou dados sensíveis aqui.
    details: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
