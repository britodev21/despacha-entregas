import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Permission
from app.modules.audit import service
from app.modules.audit.schemas import AuditPage
from app.modules.auth.dependencies import require_permission
from app.modules.users.models import User

router = APIRouter(prefix="/audit", tags=["audit"])

DB = Annotated[Session, Depends(get_db)]
Auditor = Annotated[User, Depends(require_permission(Permission.AUDIT_READ))]

Category = Literal["auth", "user", "client", "delivery", "deliveries", "settings"]


@router.get("", response_model=AuditPage)
def list_logs(
    user: Auditor,
    db: DB,
    category: Category | None = None,
    user_id: uuid.UUID | None = None,
    resource_id: Annotated[str | None, Query(max_length=64)] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AuditPage:
    items, total = service.list_logs(
        db,
        user.company,
        category=category,
        user_id=user_id,
        resource_id=resource_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return AuditPage(items=items, total=total, limit=limit, offset=offset)
