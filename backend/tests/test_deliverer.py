"""Área do entregador: só as próprias entregas, só os próprios passos."""

import pytest
from sqlalchemy import select

from app.core.permissions import Role
from app.modules.audit.models import AuditAction, AuditLog

ME = "/api/v1/me/deliveries"


@pytest.fixture
def operator_headers(make_user, auth_headers):
    return auth_headers(make_user(Role.OPERATOR))


@pytest.fixture
def deliverer(make_user):
    return make_user(Role.DELIVERER, phone="5511911112222")


@pytest.fixture
def other_deliverer(make_user):
    return make_user(Role.DELIVERER, phone="5511933334444")


@pytest.fixture
def customer(client, operator_headers):
    return client.post(
        "/api/v1/clients",
        json={
            "name": "Maria",
            "phone": "11987654321",
            "addresses": [
                {"street": "Rua A", "number": "1", "neighborhood": "B", "city": "C", "state": "SP"}
            ],
        },
        headers=operator_headers,
    ).json()


@pytest.fixture
def make_delivery(client, operator_headers, customer):
    def _make(deliverer=None, **extra) -> dict:
        payload = {
            "client_id": customer["id"],
            "client_address_id": customer["addresses"][0]["id"],
            **extra,
        }
        if deliverer is not None:
            payload["deliverer_id"] = str(deliverer.id)
        response = client.post("/api/v1/deliveries", json=payload, headers=operator_headers)
        assert response.status_code == 201, response.text
        return response.json()

    return _make


@pytest.fixture
def me(auth_headers, deliverer):
    return auth_headers(deliverer)


def test_sees_only_own_deliveries(client, me, make_delivery, deliverer, other_deliverer):
    mine = make_delivery(deliverer)
    make_delivery(other_deliverer)
    make_delivery()  # pendente, sem entregador

    body = client.get(ME, headers=me).json()
    assert [d["id"] for d in body["items"]] == [mine["id"]]


def test_cannot_open_or_act_on_someone_elses_delivery(client, me, make_delivery, other_deliverer):
    theirs = make_delivery(other_deliverer)
    url = f"{ME}/{theirs['id']}"
    assert client.get(url, headers=me).status_code == 404
    assert client.post(f"{url}/start", headers=me).status_code == 404
    complete = client.post(f"{url}/complete", json={}, headers=me)
    assert complete.status_code == 404


def test_cannot_use_operator_endpoints(client, me, make_delivery, deliverer):
    delivery = make_delivery(deliverer)
    assert client.get("/api/v1/deliveries", headers=me).status_code == 403
    cancel = client.post(
        f"/api/v1/deliveries/{delivery['id']}/cancel", json={"reason": "não quero"}, headers=me
    )
    assert cancel.status_code == 403


def test_full_flow_with_proof(client, me, make_delivery, deliverer):
    delivery = make_delivery(deliverer)
    url = f"{ME}/{delivery['id']}"

    started = client.post(f"{url}/start", headers=me).json()
    assert started["status"] == "IN_ROUTE"

    done = client.post(
        f"{url}/complete",
        json={
            "received_by_name": "  João (porteiro) ",
            "notes": "Deixado na portaria",
            "lat": "-23.561684",
            "lng": "-46.655981",
        },
        headers=me,
    ).json()
    assert done["status"] == "DELIVERED"
    assert done["proof"]["received_by_name"] == "João (porteiro)"
    assert done["proof"]["lat"] == "-23.561684"

    history = client.get(ME, params={"scope": "history"}, headers=me).json()
    assert [d["id"] for d in history["items"]] == [delivery["id"]]
    assert client.get(ME, headers=me).json()["total"] == 0


def test_issue_then_resume(client, me, make_delivery, deliverer, db):
    delivery = make_delivery(deliverer)
    url = f"{ME}/{delivery['id']}"
    client.post(f"{url}/start", headers=me)

    issue = client.post(
        f"{url}/issues",
        json={"type": "CUSTOMER_ABSENT", "description": "Ninguém atende"},
        headers=me,
    ).json()
    assert issue["status"] == "ISSUE"
    [occurrence] = issue["occurrences"]
    assert occurrence["type"] == "CUSTOMER_ABSENT"
    assert occurrence["reporter"]["id"] == str(deliverer.id)
    assert db.scalar(select(AuditLog).where(AuditLog.action == AuditAction.DELIVERY_ISSUE_REPORTED))

    resumed = client.post(f"{url}/start", headers=me).json()
    assert resumed["status"] == "IN_ROUTE"


@pytest.mark.parametrize(
    ("steps", "action", "body"),
    [
        ([], "complete", {}),  # precisa sair antes de finalizar
        ([], "issues", {"type": "REFUSED"}),  # ocorrência só em rota
        (["start"], "start", None),  # já está em rota
    ],
)
def test_deliverer_transition_rules(client, me, make_delivery, deliverer, steps, action, body):
    delivery = make_delivery(deliverer)
    url = f"{ME}/{delivery['id']}"
    for step in steps:
        client.post(f"{url}/{step}", headers=me)
    response = client.post(f"{url}/{action}", json=body, headers=me)
    assert response.status_code == 409


def test_issue_other_requires_description(client, me, make_delivery, deliverer):
    delivery = make_delivery(deliverer)
    url = f"{ME}/{delivery['id']}"
    client.post(f"{url}/start", headers=me)
    response = client.post(f"{url}/issues", json={"type": "OTHER"}, headers=me)
    assert response.status_code == 422


def test_location_needs_both_coordinates(client, me, make_delivery, deliverer):
    delivery = make_delivery(deliverer)
    url = f"{ME}/{delivery['id']}"
    client.post(f"{url}/start", headers=me)
    response = client.post(f"{url}/complete", json={"lat": "-23.5"}, headers=me)
    assert response.status_code == 422


def test_active_order_puts_current_first(client, me, make_delivery, deliverer):
    waiting = make_delivery(deliverer)
    current = make_delivery(deliverer)
    client.post(f"{ME}/{current['id']}/start", headers=me)
    ids = [d["id"] for d in client.get(ME, headers=me).json()["items"]]
    assert ids == [current["id"], waiting["id"]]


def test_operator_can_register_issue_and_complete_with_proof(
    client, operator_headers, make_delivery, deliverer
):
    delivery = make_delivery(deliverer)
    base = f"/api/v1/deliveries/{delivery['id']}"
    client.post(f"{base}/start", headers=operator_headers)
    issue = client.post(f"{base}/issues", json={"type": "WRONG_ADDRESS"}, headers=operator_headers)
    assert issue.json()["status"] == "ISSUE"
    done = client.post(
        f"{base}/complete", json={"received_by_name": "Maria"}, headers=operator_headers
    )
    assert done.json()["status"] == "DELIVERED"
    assert done.json()["proof"]["received_by_name"] == "Maria"
