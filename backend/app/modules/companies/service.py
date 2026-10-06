from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.companies.models import DEFAULT_TIMEZONE, Company


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
