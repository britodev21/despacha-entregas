import uuid

from sqlalchemy.orm import Session

from app.core.context import client_ip_var, user_agent_var
from app.modules.audit.models import AuditAction, AuditLog


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
