"""Painel, relatório por entregador e exportação CSV."""

import csv
import io
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select, update

from app.core.permissions import Role
from app.modules.audit.models import AuditAction, AuditLog
from app.modules.deliveries.models import Delivery

DASHBOARD = "/api/v1/dashboard/summary"
REPORT = "/api/v1/reports/deliverers"
EXPORT = "/api/v1/deliveries/export.csv"


@pytest.fixture
def headers(make_user, auth_headers):
    return auth_headers(make_user(Role.OPERATOR))


@pytest.fixture
def deliverer(make_user):
    return make_user(Role.DELIVERER, phone="5511911112222")


@pytest.fixture
def customer(client, headers):
    return client.post(
        "/api/v1/clients",
        json={
            "name": "Maria",
            "phone": "11987654321",
            "addresses": [
                {
                    "street": "Rua A",
                    "number": "1",
                    "neighborhood": "Centro",
                    "city": "Santos",
                    "state": "SP",
                }
            ],
        },
        headers=headers,
    ).json()


@pytest.fixture
def new_delivery(client, headers, customer):
    def _new(**extra) -> dict:
        payload = {
            "client_id": customer["id"],
            "client_address_id": customer["addresses"][0]["id"],
            **extra,
        }
        response = client.post("/api/v1/deliveries", json=payload, headers=headers)
        assert response.status_code == 201, response.text
        return response.json()

    return _new


def act(client, headers, delivery, action, body=None):
    response = client.post(
        f"/api/v1/deliveries/{delivery['id']}/{action}", json=body, headers=headers
    )
    assert response.status_code == 200, response.text
    return response.json()


def set_times(db, delivery, **values):
    db.execute(update(Delivery).where(Delivery.id == delivery["id"]).values(**values))
    db.commit()


# ------------------------------------------------------------------ painel


def test_dashboard_counts_and_attention(client, headers, new_delivery, deliverer, db):
    waiting = new_delivery()
    set_times(db, waiting, created_at=datetime.now(UTC) - timedelta(minutes=40))
    late = new_delivery(deliverer_id=str(deliverer.id))
    set_times(db, late, expected_at=datetime.now(UTC) - timedelta(minutes=5))
    issue = new_delivery(deliverer_id=str(deliverer.id))
    act(client, headers, issue, "start")
    act(client, headers, issue, "issues", {"type": "CUSTOMER_ABSENT"})
    done = new_delivery(deliverer_id=str(deliverer.id), delivery_fee="7.00")
    act(client, headers, done, "start")
    act(client, headers, done, "complete")

    body = client.get(DASHBOARD, headers=headers).json()
    assert body["created_today"] == 4
    assert body["pending"] == 1
    assert body["assigned"] == 1
    assert body["issues"] == 1
    assert body["delivered_today"] == 1
    assert body["active_deliverers"] == 1
    reasons = [(item["number"], item["reason"]) for item in body["attention"]]
    assert reasons == [
        (issue["number"], "ISSUE"),
        (late["number"], "LATE"),
        (waiting["number"], "WAITING"),
    ]


def test_today_uses_company_timezone(client, headers, new_delivery, company, db):
    tz = ZoneInfo(company.timezone)
    local_midnight = datetime.combine(datetime.now(tz).date(), time.min, tz)
    yesterday_late = new_delivery()
    # 1 minuto antes da meia-noite LOCAL: é "ontem" para a empresa,
    # mesmo que em UTC já seja hoje.
    set_times(db, yesterday_late, created_at=local_midnight - timedelta(minutes=1))
    new_delivery()

    body = client.get(DASHBOARD, headers=headers).json()
    assert body["created_today"] == 1


def test_average_delivery_time(client, headers, new_delivery, deliverer, db):
    delivery = new_delivery(deliverer_id=str(deliverer.id))
    act(client, headers, delivery, "start")
    act(client, headers, delivery, "complete")
    now = datetime.now(UTC)
    set_times(db, delivery, created_at=now - timedelta(minutes=30), delivered_at=now)
    assert client.get(DASHBOARD, headers=headers).json()["avg_delivery_minutes_today"] == 30


def test_deliverer_cannot_see_dashboard(client, auth_headers, deliverer):
    assert client.get(DASHBOARD, headers=auth_headers(deliverer)).status_code == 403


# ------------------------------------------------------- relatório entregador


def test_deliverer_report(client, headers, new_delivery, deliverer, make_user, db):
    other = make_user(Role.DELIVERER, phone="5511933334444")
    for fee in ("7.00", "8.50"):
        d = new_delivery(deliverer_id=str(deliverer.id), delivery_fee=fee)
        act(client, headers, d, "start")
        act(client, headers, d, "complete")
    canceled = new_delivery(deliverer_id=str(other.id), delivery_fee="9.00")
    act(client, headers, canceled, "cancel", {"reason": "cliente desistiu"})
    with_issue = new_delivery(deliverer_id=str(other.id))
    act(client, headers, with_issue, "start")
    act(client, headers, with_issue, "issues", {"type": "WRONG_ADDRESS"})

    rows = {row["deliverer_id"]: row for row in client.get(REPORT, headers=headers).json()}
    main = rows[str(deliverer.id)]
    assert main["delivered"] == 2
    assert main["fees_total"] == "15.50"  # taxa de canceladas não entra
    second = rows[str(other.id)]
    assert second["canceled"] == 1 and second["issues"] == 1 and second["fees_total"] == "0.00"


@pytest.mark.parametrize(
    "params",
    [
        {"date_from": "2026-10-10", "date_to": "2026-10-01"},
        {"date_from": "2026-01-01", "date_to": "2026-12-31"},
    ],
)
def test_report_range_validation(client, headers, params):
    assert client.get(REPORT, params=params, headers=headers).status_code == 400


# ----------------------------------------------------------------- exportação


def test_export_csv_is_excel_friendly_and_safe(client, headers, new_delivery, db):
    new_delivery(recipient_name='=HYPERLINK("http://golpe.example","clique")', order_amount="58.90")
    response = client.get(EXPORT, headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment;" in response.headers["content-disposition"]

    text = response.content.decode("utf-8")
    assert text.startswith("﻿")  # BOM para o Excel
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿")), delimiter=";"))
    header, row = rows[0], rows[1]
    assert "Telefone" not in header  # minimização de dados
    recipient = row[header.index("Destinatário")]
    assert recipient.startswith("'=")  # neutralizado: não vira fórmula
    assert row[header.index("Valor do pedido")] == "58,90"

    log = db.scalar(select(AuditLog).where(AuditLog.action == AuditAction.DELIVERIES_EXPORTED))
    assert log is not None and log.details["rows"] == 1


def test_export_is_scoped_and_protected(
    client, headers, new_delivery, make_user, auth_headers, other_company, deliverer
):
    new_delivery()
    outsider = auth_headers(make_user(Role.OPERATOR, company=other_company))
    rows = client.get(EXPORT, headers=outsider).content.decode("utf-8").strip().splitlines()
    assert len(rows) == 1  # só o cabeçalho
    assert client.get(EXPORT, headers=auth_headers(deliverer)).status_code == 403
