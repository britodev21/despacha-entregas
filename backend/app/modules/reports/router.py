from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Permission
from app.modules.auth.dependencies import require_permission
from app.modules.reports import service
from app.modules.reports.schemas import DashboardSummary, DelivererReportRow
from app.modules.users.models import User

router = APIRouter(tags=["reports"])

DB = Annotated[Session, Depends(get_db)]
Reader = Annotated[User, Depends(require_permission(Permission.DASHBOARD_READ))]


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard(user: Reader, db: DB) -> DashboardSummary:
    return service.dashboard_summary(db, user.company)


@router.get("/reports/deliverers", response_model=list[DelivererReportRow])
def deliverer_report(
    user: Reader,
    db: DB,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[DelivererReportRow]:
    today = service.local_today(user.company)
    return service.deliverer_report(db, user.company, date_from or today, date_to or today)
