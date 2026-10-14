from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.audit import service as audit
from app.modules.audit.models import AuditAction
from app.modules.companies.models import DEFAULT_TIMEZONE, Company
from app.modules.companies.schemas import CompanySettings, CompanySettingsUpdate


def create_company(db: Session, *, name: str, timezone: str = DEFAULT_TIMEZONE) -> Company:
    name = name.strip()
    if not name:
        raise AppError("Nome da empresa é obrigatório.", code="COMPANY_NAME_REQUIRED")
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError, ValueError:  # Python 3.14+: parênteses opcionais (PEP 758)
        raise AppError(f"Fuso horário inválido: {timezone}", code="INVALID_TIMEZONE") from None

    company = Company(name=name, timezone=timezone)
    db.add(company)
    db.commit()
    return company


def company_settings(company: Company) -> CompanySettings:
    """Configurações da empresa validadas (JSONB → schema com valores padrão)."""
    return CompanySettings.model_validate(company.settings or {})


def update_settings(db: Session, actor, data: CompanySettingsUpdate) -> Company:
    company = db.get(Company, actor.company_id)
    before = company_settings(company).model_dump()
    # Atribui um dicionário NOVO: o SQLAlchemy detecta a mudança no JSONB.
    company.settings = {**(company.settings or {}), **data.model_dump()}
    audit.record(
        db,
        AuditAction.SETTINGS_UPDATED,
        company_id=company.id,
        user_id=actor.id,
        resource_type="company",
        resource_id=company.id,
        details={"before": before, "after": data.model_dump()},
    )
    db.commit()
    return company
