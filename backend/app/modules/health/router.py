import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]


@router.get("/health", response_model=HealthOut)
def health(response: Response, db: Annotated[Session, Depends(get_db)]) -> HealthOut:
    """Usado pelo monitoramento. Não expõe versões nem detalhes internos."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Health check: banco indisponível")
        response.status_code = 503
        return HealthOut(status="degraded", database="unavailable")
    return HealthOut(status="ok", database="ok")
