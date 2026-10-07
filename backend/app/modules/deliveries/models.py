import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.deliveries.state_machine import DeliveryStatus
from app.modules.users.models import User


class PaymentMethod(StrEnum):
    CASH = "CASH"
    PIX = "PIX"
    CREDIT_CARD = "CREDIT_CARD"
    DEBIT_CARD = "DEBIT_CARD"
    PREPAID = "PREPAID"  # já pago (ex.: pelo app/site)
    OTHER = "OTHER"


class OccurrenceType(StrEnum):
    CUSTOMER_ABSENT = "CUSTOMER_ABSENT"
    WRONG_ADDRESS = "WRONG_ADDRESS"
    REFUSED = "REFUSED"
    ACCESS_PROBLEM = "ACCESS_PROBLEM"
    DAMAGED_PRODUCT = "DAMAGED_PRODUCT"
    DELIVERY_PROBLEM = "DELIVERY_PROBLEM"
    OTHER = "OTHER"


def _enum(enum_cls: type[StrEnum]) -> Enum:
    # VARCHAR + CHECK explícito (em __table_args__). create_constraint=True
    # faria o Alembic gerar a mesma CHECK duas vezes.
    return Enum(enum_cls, native_enum=False, length=16, create_constraint=False)


def _check_in(column: str, enum_cls: type[StrEnum]) -> CheckConstraint:
    values = ", ".join(f"'{member.value}'" for member in enum_cls)
    return CheckConstraint(f"{column} IN ({values})", name=column)


class Delivery(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A entrega: entidade principal da operação.

    Os dados de destinatário e endereço são uma CÓPIA feita na criação
    (ADR-07): se o cliente mudar de endereço, o histórico continua correto.
    """

    __tablename__ = "deliveries"
    __table_args__ = (
        UniqueConstraint("company_id", "number", name="uq_deliveries_company_number"),
        Index("ix_deliveries_company_status", "company_id", "status"),
        Index("ix_deliveries_company_created_at", "company_id", "created_at"),
        Index("ix_deliveries_deliverer_status", "deliverer_id", "status"),
        _check_in("status", DeliveryStatus),
        _check_in("payment_method", PaymentMethod),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"))
    # Número legível, sequencial por empresa ("Entrega #482").
    number: Mapped[int]

    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"), index=True
    )
    # Referência ao endereço de origem; a cópia abaixo é o que vale.
    client_address_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("client_addresses.id", ondelete="SET NULL")
    )

    # ---- cópia (snapshot) do destinatário e endereço
    recipient_name: Mapped[str] = mapped_column(String(120))
    recipient_phone: Mapped[str | None] = mapped_column(String(15))
    zip_code: Mapped[str | None] = mapped_column(String(8))
    street: Mapped[str] = mapped_column(String(160))
    # "address_number" para não confundir com o número da entrega.
    address_number: Mapped[str] = mapped_column(String(20))
    complement: Mapped[str | None] = mapped_column(String(80))
    neighborhood: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(2))
    reference: Mapped[str | None] = mapped_column(String(160))
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))

    # ---- operação (informativo: o DESPACHA não é sistema financeiro)
    notes: Mapped[str | None] = mapped_column(Text)
    order_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    payment_method: Mapped[PaymentMethod | None] = mapped_column(_enum(PaymentMethod))
    change_for: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))  # troco para
    delivery_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    expected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    status: Mapped[DeliveryStatus] = mapped_column(
        _enum(DeliveryStatus), default=DeliveryStatus.PENDING
    )
    deliverer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    cancel_reason: Mapped[str | None] = mapped_column(String(300))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    # ---- linha do tempo (dispensa tabela de histórico de status)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    deliverer: Mapped[User | None] = relationship(foreign_keys=[deliverer_id], lazy="joined")
    # selectin: uma query extra para todas as entregas da lista (sem N+1).
    occurrences: Mapped[list[DeliveryOccurrence]] = relationship(
        back_populates="delivery", lazy="selectin", order_by="DeliveryOccurrence.created_at"
    )
    proof: Mapped[DeliveryProof | None] = relationship(
        back_populates="delivery", lazy="selectin", uselist=False
    )


class DeliveryOccurrence(UUIDPrimaryKeyMixin, Base):
    """Algo que impediu ou atrapalhou a entrega (cliente ausente, endereço errado...)."""

    __tablename__ = "delivery_occurrences"
    __table_args__ = (_check_in("type", OccurrenceType),)

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), index=True
    )
    delivery_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deliveries.id", ondelete="CASCADE"), index=True
    )
    reported_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    type: Mapped[OccurrenceType] = mapped_column(_enum(OccurrenceType))
    description: Mapped[str | None] = mapped_column(String(500))
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    delivery: Mapped[Delivery] = relationship(back_populates="occurrences")
    reporter: Mapped[User | None] = relationship(lazy="joined")


class DeliveryProof(UUIDPrimaryKeyMixin, Base):
    """Comprovante de entrega (1 por entrega). Foto e assinatura: fase 7."""

    __tablename__ = "delivery_proofs"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), index=True
    )
    delivery_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deliveries.id", ondelete="CASCADE"), unique=True
    )
    received_by_name: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(String(500))
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    delivery: Mapped[Delivery] = relationship(back_populates="proof")
