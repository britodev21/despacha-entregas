"""Painel, relatório por entregador e exportação.

"Hoje" sempre no fuso da empresa (ADR-14): meia-noite em São Paulo é 03:00
UTC; usar o dia UTC mostraria entregas de ontem no painel de hoje.
"""

import csv
import io
import uuid
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.companies.models import Company
from app.modules.deliveries.models import Delivery, DeliveryOccurrence, PaymentMethod
from app.modules.deliveries.state_machine import DeliveryStatus
from app.modules.reports.schemas import AttentionItem, DashboardSummary, DelivererReportRow
from app.modules.users.models import User

S = DeliveryStatus
WAITING_TOO_LONG = timedelta(minutes=15)  # pendente sem entregador há mais que isso
MAX_REPORT_DAYS = 93
EXPORT_LIMIT = 10_000

STATUS_LABELS = {
    S.PENDING: "Pendente",
    S.ASSIGNED: "Atribuída",
    S.IN_ROUTE: "Em rota",
    S.DELIVERED: "Entregue",
    S.CANCELED: "Cancelada",
    S.ISSUE: "Ocorrência",
}
PAYMENT_LABELS = {
    PaymentMethod.CASH: "Dinheiro",
    PaymentMethod.PIX: "Pix",
    PaymentMethod.CREDIT_CARD: "Cartão de crédito",
    PaymentMethod.DEBIT_CARD: "Cartão de débito",
    PaymentMethod.PREPAID: "Já pago",
    PaymentMethod.OTHER: "Outro",
}


def _day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tz)
    return start, start + timedelta(days=1)


def local_today(company: Company) -> date:
    return datetime.now(ZoneInfo(company.timezone)).date()


# ------------------------------------------------------------------ painel


def dashboard_summary(db: Session, company: Company) -> DashboardSummary:
    tz = ZoneInfo(company.timezone)
    now = datetime.now(UTC)
    today = now.astimezone(tz).date()
    start, end = _day_bounds(today, tz)
    yesterday_start = start - timedelta(days=1)
    base = select(func.count()).select_from(Delivery).where(Delivery.company_id == company.id)

    def count(*conditions) -> int:
        return db.scalar(base.where(*conditions)) or 0

    by_status = dict(
        db.execute(
            select(Delivery.status, func.count())
            .where(
                Delivery.company_id == company.id,
                Delivery.status.in_([S.PENDING, S.ASSIGNED, S.IN_ROUTE, S.ISSUE]),
            )
            .group_by(Delivery.status)
        ).all()
    )

    active_deliverers = db.scalar(
        select(func.count(func.distinct(Delivery.deliverer_id))).where(
            Delivery.company_id == company.id,
            Delivery.status.in_([S.ASSIGNED, S.IN_ROUTE, S.ISSUE]),
        )
    )

    avg_seconds = db.scalar(
        select(func.avg(func.extract("epoch", Delivery.delivered_at - Delivery.created_at))).where(
            Delivery.company_id == company.id,
            Delivery.delivered_at >= start,
            Delivery.delivered_at < end,
        )
    )

    return DashboardSummary(
        today=today,
        created_today=count(Delivery.created_at >= start, Delivery.created_at < end),
        created_yesterday_until_now=count(
            Delivery.created_at >= yesterday_start,
            Delivery.created_at < now - timedelta(days=1),
        ),
        delivered_today=count(Delivery.delivered_at >= start, Delivery.delivered_at < end),
        canceled_today=count(Delivery.canceled_at >= start, Delivery.canceled_at < end),
        pending=by_status.get(S.PENDING, 0),
        assigned=by_status.get(S.ASSIGNED, 0),
        in_route=by_status.get(S.IN_ROUTE, 0),
        issues=by_status.get(S.ISSUE, 0),
        active_deliverers=active_deliverers or 0,
        avg_delivery_minutes_today=round(avg_seconds / 60) if avg_seconds else None,
        attention=_attention(db, company, now),
    )


def _attention(db: Session, company: Company, now: datetime) -> list[AttentionItem]:
    """O que precisa de ação: ocorrências, atrasadas e pendentes esperando demais."""
    candidates = db.scalars(
        select(Delivery)
        .where(
            Delivery.company_id == company.id,
            or_(
                Delivery.status == S.ISSUE,
                Delivery.expected_at < now,
                (Delivery.status == S.PENDING) & (Delivery.created_at < now - WAITING_TOO_LONG),
            ),
            Delivery.status.in_([S.PENDING, S.ASSIGNED, S.IN_ROUTE, S.ISSUE]),
        )
        .order_by(Delivery.created_at)
        .limit(50)
    ).all()

    items = []
    for d in candidates:
        if d.status == S.ISSUE:
            reason = "ISSUE"
            since = d.occurrences[-1].created_at if d.occurrences else d.updated_at
        elif d.expected_at and d.expected_at < now:
            reason, since = "LATE", d.expected_at
        else:
            reason, since = "WAITING", d.created_at
        items.append(
            AttentionItem(
                delivery_id=d.id,
                number=d.number,
                recipient_name=d.recipient_name,
                neighborhood=d.neighborhood,
                status=d.status,
                reason=reason,
                since=since,
                deliverer_name=d.deliverer.name if d.deliverer else None,
            )
        )
    # Ocorrências primeiro, depois atrasadas, depois esperando; mais antigas no topo.
    order = {"ISSUE": 0, "LATE": 1, "WAITING": 2}
    items.sort(key=lambda item: (order[item.reason], item.since))
    return items[:20]


# ------------------------------------------------------ relatório entregador


def _range(company: Company, date_from: date, date_to: date) -> tuple[datetime, datetime]:
    if date_to < date_from:
        raise AppError("A data final deve ser depois da inicial.", code="INVALID_RANGE")
    if (date_to - date_from).days > MAX_REPORT_DAYS:
        raise AppError(f"Período máximo de {MAX_REPORT_DAYS} dias.", code="RANGE_TOO_LONG")
    tz = ZoneInfo(company.timezone)
    return _day_bounds(date_from, tz)[0], _day_bounds(date_to, tz)[1]


def deliverer_report(
    db: Session, company: Company, date_from: date, date_to: date
) -> list[DelivererReportRow]:
    """Resumo por entregador no período: o "acerto do dia" com o motoboy.

    Informativo: o DESPACHA não é sistema financeiro (seção 1).
    """
    start, end = _range(company, date_from, date_to)
    in_period = lambda column: (column >= start) & (column < end)  # noqa: E731

    delivered = case((in_period(Delivery.delivered_at), 1), else_=0)
    canceled = case((in_period(Delivery.canceled_at), 1), else_=0)
    rows = db.execute(
        select(
            Delivery.deliverer_id,
            func.sum(delivered),
            func.sum(canceled),
            func.coalesce(
                func.sum(case((in_period(Delivery.delivered_at), Delivery.delivery_fee), else_=0)),
                0,
            ),
            func.avg(
                case(
                    (
                        in_period(Delivery.delivered_at),
                        func.extract("epoch", Delivery.delivered_at - Delivery.started_at),
                    ),
                )
            ),
        )
        .where(
            Delivery.company_id == company.id,
            Delivery.deliverer_id.is_not(None),
            or_(in_period(Delivery.delivered_at), in_period(Delivery.canceled_at)),
        )
        .group_by(Delivery.deliverer_id)
    ).all()

    issues = dict(
        db.execute(
            select(Delivery.deliverer_id, func.count(DeliveryOccurrence.id))
            .join(DeliveryOccurrence, DeliveryOccurrence.delivery_id == Delivery.id)
            .where(
                Delivery.company_id == company.id,
                Delivery.deliverer_id.is_not(None),
                in_period(DeliveryOccurrence.created_at),
            )
            .group_by(Delivery.deliverer_id)
        ).all()
    )

    stats = {row[0]: row for row in rows}
    user_ids = set(stats) | set(issues)
    if not user_ids:
        return []
    names = dict(
        db.execute(
            select(User.id, User.name).where(User.id.in_(user_ids), User.company_id == company.id)
        ).all()
    )
    report = []
    for user_id in user_ids:
        row = stats.get(user_id)
        avg = row[4] if row else None
        report.append(
            DelivererReportRow(
                deliverer_id=user_id,
                name=names.get(user_id, "—"),
                delivered=int(row[1]) if row else 0,
                canceled=int(row[2]) if row else 0,
                issues=issues.get(user_id, 0),
                fees_total=Decimal(row[3]).quantize(Decimal("0.01")) if row else Decimal("0.00"),
                avg_minutes=round(float(avg) / 60) if avg else None,
            )
        )
    report.sort(key=lambda r: (-r.delivered, r.name))
    return report


# ----------------------------------------------------------- exportação CSV


def _safe_cell(value: object) -> str:
    """Evita "CSV injection": Excel/Sheets executam células que começam com
    = + - @ como fórmula (ex.: =HYPERLINK(...) roubando dados). Prefixamos
    com apóstrofo, que faz a planilha tratar como texto."""
    text = "" if value is None else str(value)
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + text
    return text


def _money(value: Decimal | None) -> str:
    return "" if value is None else f"{value:.2f}".replace(".", ",")


def export_csv(deliveries: list[Delivery], company: Company) -> str:
    """CSV para Excel brasileiro: separador ";", decimal com vírgula, UTF-8 com BOM.

    Minimização (LGPD): sem telefone nem endereço completo — só o necessário
    para conferência da operação.
    """
    tz = ZoneInfo(company.timezone)

    def local(dt: datetime | None) -> str:
        return dt.astimezone(tz).strftime("%d/%m/%Y %H:%M") if dt else ""

    out = io.StringIO()
    out.write("﻿")  # BOM: o Excel reconhece os acentos
    writer = csv.writer(out, delimiter=";", lineterminator="\r\n")
    writer.writerow(
        [
            "Número",
            "Criada em",
            "Status",
            "Destinatário",
            "Bairro",
            "Cidade",
            "Entregador",
            "Valor do pedido",
            "Taxa de entrega",
            "Pagamento",
            "Entregue em",
            "Cancelada em",
            "Motivo do cancelamento",
        ]
    )
    for d in deliveries:
        writer.writerow(
            [
                _safe_cell(cell)
                for cell in (
                    d.number,
                    local(d.created_at),
                    STATUS_LABELS[d.status],
                    d.recipient_name,
                    d.neighborhood,
                    d.city,
                    d.deliverer.name if d.deliverer else "",
                    _money(d.order_amount),
                    _money(d.delivery_fee),
                    PAYMENT_LABELS.get(d.payment_method, "") if d.payment_method else "",
                    local(d.delivered_at),
                    local(d.canceled_at),
                    d.cancel_reason or "",
                )
            ]
        )
    return out.getvalue()


def export_filename(company_id: uuid.UUID, today: date) -> str:
    return f"despacha-entregas-{today:%Y-%m-%d}.csv"
