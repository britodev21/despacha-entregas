from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Permission
from app.modules.auth.dependencies import CurrentUser, require_permission
from app.modules.companies import service
from app.modules.companies.models import Company
from app.modules.companies.schemas import CompanyOut, CompanySettingsUpdate
from app.modules.users.models import User

router = APIRouter(prefix="/company", tags=["company"])

DB = Annotated[Session, Depends(get_db)]
Admin = Annotated[User, Depends(require_permission(Permission.SETTINGS_MANAGE))]


def _out(company: Company) -> CompanyOut:
    return CompanyOut(
        id=company.id,
        name=company.name,
        timezone=company.timezone,
        settings=service.company_settings(company),
    )


@router.get("", response_model=CompanyOut)
def get_company(user: CurrentUser) -> CompanyOut:
    """Qualquer usuário da empresa: o entregador precisa saber o que o
    comprovante exige. Não há dado sensível aqui."""
    return _out(user.company)


@router.patch("/settings", response_model=CompanyOut)
def update_settings(body: CompanySettingsUpdate, admin: Admin, db: DB) -> CompanyOut:
    return _out(service.update_settings(db, admin, body))
