import uuid
from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.context import client_ip_var, user_agent_var
from app.modules.audit.models import AuditAction, AuditLog
from app.modules.audit.schemas import AuditLogOut, AuditUserOut

if TYPE_CHECKING:
    from app.modules.companies.models import Company


def record(
    db: Session,
    action: AuditAction,
    *,
    company_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    resource_id: uuid.UUID | str | None = None,
    details: dict | None = None,
) -> None:
    """Adiciona um registro de auditoria à sessão atual.

    Não faz commit: o log entra na MESMA transação da ação auditada.
    Ou os dois são salvos, ou nenhum (nunca uma ação sem registro).
    IP e navegador vêm do contexto da requisição (app/core/context.py).
    """
    db.add(
        AuditLog(
            action=action,
            company_id=company_id,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            ip=client_ip_var.get(),
            user_agent=user_agent_var.get(),
            details=details or {},
        )
    )


# ------------------------------------------------------------------ consulta


def list_logs(
    db: Session,
    company: Company,
    *,
    category: str | None = None,
    user_id: uuid.UUID | None = None,
    resource_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AuditLogOut], int]:
    """Logs da empresa, mais recentes primeiro. Somente leitura: não existe
    rota que altere ou apague auditoria (e o banco também não deixa)."""
    stmt = select(AuditLog).where(AuditLog.company_id == company.id)
    if category:
        # "auth" → auth.*; o ponto evita "user" casar com "users.x" no futuro.
        stmt = stmt.where(AuditLog.action.startswith(f"{category}.", autoescape=True))
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if resource_id:
        stmt = stmt.where(AuditLog.resource_id == resource_id)
    tz = ZoneInfo(company.timezone)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= datetime.combine(date_from, time.min, tz))
    if date_to:
        end = datetime.combine(date_to + timedelta(days=1), time.min, tz)
        stmt = stmt.where(AuditLog.created_at < end)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    logs = db.scalars(stmt.order_by(AuditLog.id.desc()).limit(limit).offset(offset)).all()

    from app.modules.users.models import User  # import local: evita ciclo de imports

    names = {}
    user_ids = {log.user_id for log in logs if log.user_id}
    if user_ids:
        names = dict(db.execute(select(User.id, User.name).where(User.id.in_(user_ids))).all())

    items = [
        AuditLogOut(
            id=log.id,
            action=log.action,
            created_at=log.created_at,
            user=AuditUserOut(id=log.user_id, name=names.get(log.user_id, "Usuário removido"))
            if log.user_id
            else None,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            ip=log.ip,
            user_agent=log.user_agent,
            details=log.details or {},
        )
        for log in logs
    ]
    return items, total
