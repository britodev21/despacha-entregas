import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Index, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class DelivererLocation(Base):
    """Posição do entregador durante a operação (ADR-08).

    Ligada ao ENTREGADOR, não à entrega: quem sai com 3 pedidos gera um
    ponto por vez, não três. O trajeto de uma entrega é reconstruído pelo
    intervalo started_at → delivered_at.

    Alto volume: chave bigint (UUID seria desperdício) e índice para "última
    posição de cada entregador".
    """

    __tablename__ = "deliverer_locations"
    __table_args__ = (
        Index("ix_deliverer_locations_user_recorded", "user_id", "recorded_at"),
        Index("ix_deliverer_locations_company_received", "company_id", "received_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    lat: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    lng: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    accuracy_m: Mapped[Decimal | None] = mapped_column(Numeric(8, 1))
    # Relógio do celular (quando foi medido) e do servidor (quando chegou).
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
