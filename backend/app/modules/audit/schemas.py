import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditUserOut(BaseModel):
    id: uuid.UUID
    name: str


class AuditLogOut(BaseModel):
    id: int
    action: str
    created_at: datetime
    user: AuditUserOut | None  # None = ação do sistema (CLI) ou usuário não identificado
    resource_type: str | None
    resource_id: str | None
    ip: str | None
    user_agent: str | None
    details: dict


class AuditPage(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int
