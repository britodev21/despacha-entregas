import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Index, Numeric, String, Text, false, text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Client(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Quem recebe as entregas. Só o nome é obrigatório (coletar o mínimo)."""

    __tablename__ = "clients"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    # Só dígitos, com DDI (5511987654321). Não é único: uma família pode
    # dividir o mesmo telefone. Indexado: é por ele que o operador busca.
    phone: Mapped[str | None] = mapped_column(String(15), index=True)
    email: Mapped[str | None] = mapped_column(String(254))
    # CPF ou CNPJ, só dígitos. Opcional: o DESPACHA não emite nota fiscal.
    document: Mapped[str | None] = mapped_column(String(14))
    notes: Mapped[str | None] = mapped_column(Text)
    # Arquivar em vez de apagar: entregas antigas continuam apontando para cá.
    is_active: Mapped[bool] = mapped_column(server_default=true())

    addresses: Mapped[list[ClientAddress]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
        order_by="(ClientAddress.is_default.desc(), ClientAddress.created_at)",
    )


class ClientAddress(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "client_addresses"
    __table_args__ = (
        # No máximo UM endereço principal por cliente, garantido pelo banco
        # (índice único parcial: só conta as linhas com is_default = true).
        Index(
            "uq_client_addresses_one_default",
            "client_id",
            unique=True,
            postgresql_where=text("is_default"),
        ),
    )

    # company_id repetido aqui de propósito: toda consulta filtra por empresa
    # sem precisar de JOIN com clients (isolamento simples e barato).
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str | None] = mapped_column(String(40))  # "Casa", "Trabalho"
    zip_code: Mapped[str | None] = mapped_column(String(8))
    street: Mapped[str] = mapped_column(String(160))
    number: Mapped[str] = mapped_column(String(20))  # aceita "S/N", "120A"
    complement: Mapped[str | None] = mapped_column(String(80))
    neighborhood: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(2))
    # Ponto de referência: muitas vezes vale mais que o número da casa.
    reference: Mapped[str | None] = mapped_column(String(160))
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    is_default: Mapped[bool] = mapped_column(server_default=false())

    client: Mapped[Client] = relationship(back_populates="addresses")
