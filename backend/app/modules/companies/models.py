from sqlalchemy import String, true
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin, UUIDPrimaryKeyMixin

DEFAULT_TIMEZONE = "America/Sao_Paulo"


class Company(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Empresa cliente do DESPACHA (o "tenant").

    Toda tabela de negócio aponta para cá via company_id (ver ADR-01).
    """

    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(120))
    # Fuso usado para calcular "hoje" no dashboard. Datas são salvas em UTC.
    timezone: Mapped[str] = mapped_column(String(64), server_default=DEFAULT_TIMEZONE)
    # Preferências operacionais (ex.: exigir foto no comprovante).
    # Validado por um schema Pydantic antes de salvar.
    settings: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    # Próximo número legível de entrega ("Entrega #482"), sequencial por empresa.
    next_delivery_number: Mapped[int] = mapped_column(server_default="1")
    is_active: Mapped[bool] = mapped_column(server_default=true())
