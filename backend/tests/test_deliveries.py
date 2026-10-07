"""Entregas: criação, snapshot, numeração, máquina de estados e isolamento."""

import pytest
from sqlalchemy import select

from app.core.permissions import Role
from app.modules.audit.models import AuditAction, AuditLog

DELIVERIES = "/api/v1/deliveries"


@pytest.fixture
def operator(make_user):
    return make_user(Role.OPERATOR)


@pytest.fixture
def headers(auth_headers, operator):
    return auth_headers(operator)


@pytest.fixture
def deliverer(make_user):
    return make_user(Role.DELIVERER, phone="5511911112222")


@pytest.fixture
def customer(client, headers):
    """Cliente com um endereço, criado pela API."""
    response = client.post(
        "/api/v1/clients",
        json={
            "name": "Maria Souza",
            "phone": "(11) 98765-4321",
            "addresses": [
                {
                    "street": "Rua das Flores",
                    "number": "45",
                    "neighborhood": "Centro",
                    "city": "Santos",
                    "state": "SP",
                    "reference": "Portão azul",
                }
            ],
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def new_delivery(client, headers, customer, **overrides) -> dict:
    payload = {
        "client_id": customer["id"],
        "client_address_id": customer["addresses"][0]["id"],
        "order_amount": "58.90",
        "payment_method": "CASH",
        "change_for": "100.00",
        "delivery_fee": "7.00",
        **overrides,
    }
    response = client.post(DELIVERIES, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def act(client, headers, delivery, action, json=None):
    return client.post(f"{DELIVERIES}/{delivery['id']}/{action}", json=json, headers=headers)


# --------------------------------------------------------------- criação


def test_create_copies_client_and_address(client, headers, customer):
    body = new_delivery(client, headers, customer)
    assert body["status"] == "PENDING"
    assert body["recipient_name"] == "Maria Souza"
    assert body["recipient_phone"] == "5511987654321"
    assert body["street"] == "Rua das Flores" and body["address_number"] == "45"
    assert body["reference"] == "Portão azul"
    assert body["order_amount"] == "58.90"  # decimal como texto, nunca float


def test_snapshot_survives_address_change(client, headers, customer):
    delivery = new_delivery(client, headers, customer)
    address_url = f"/api/v1/clients/{customer['id']}/addresses/{customer['addresses'][0]['id']}"
    client.patch(address_url, json={"street": "Rua Nova"}, headers=headers)

    body = client.get(f"{DELIVERIES}/{delivery['id']}", headers=headers).json()
    assert body["street"] == "Rua das Flores"


def test_numbers_are_sequential_per_company(client, headers, customer):
    first = new_delivery(client, headers, customer)
    second = new_delivery(client, headers, customer)
    assert second["number"] == first["number"] + 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"payment_method": "PIX", "change_for": "50.00"},  # troco sem dinheiro
        {"order_amount": "80.00", "change_for": "50.00"},  # troco menor que o pedido
        {"order_amount": "-1"},
        {"order_amount": "10.999"},
        {"status": "DELIVERED"},  # status não é definido pelo cliente da API
    ],
)
def test_create_validation(client, headers, customer, overrides):
    payload = {
        "client_id": customer["id"],
        "client_address_id": customer["addresses"][0]["id"],
        **overrides,
    }
    assert client.post(DELIVERIES, json=payload, headers=headers).status_code == 422


def test_create_with_deliverer_is_assigned(client, headers, customer, deliverer):
    body = new_delivery(client, headers, customer, deliverer_id=str(deliverer.id))
    assert body["status"] == "ASSIGNED"
    assert body["deliverer"]["id"] == str(deliverer.id)
    assert body["assigned_at"] is not None


def test_address_must_belong_to_client(client, headers, customer):
    other = client.post(
        "/api/v1/clients",
        json={
            "name": "Outro",
            "addresses": [
                {"street": "A", "number": "1", "neighborhood": "B", "city": "C", "state": "SP"}
            ],
        },
        headers=headers,
    ).json()
    payload = {"client_id": customer["id"], "client_address_id": other["addresses"][0]["id"]}
    assert client.post(DELIVERIES, json=payload, headers=headers).status_code == 404


# ----------------------------------------------------- máquina de estados


def test_happy_path_fills_timeline(client, headers, customer, deliverer, db):
    delivery = new_delivery(client, headers, customer)

    assigned = act(client, headers, delivery, "assign", {"deliverer_id": str(deliverer.id)})
    assert assigned.json()["status"] == "ASSIGNED"
    started = act(client, headers, delivery, "start")
    assert started.json()["status"] == "IN_ROUTE" and started.json()["started_at"]
    done = act(client, headers, delivery, "complete")
    assert done.json()["status"] == "DELIVERED" and done.json()["delivered_at"]

    transitions = db.scalars(
        select(AuditLog.details).where(
            AuditLog.action == AuditAction.DELIVERY_STATUS_CHANGED,
            AuditLog.resource_id == delivery["id"],
        )
    ).all()
    assert [t["to"] for t in transitions] == ["ASSIGNED", "IN_ROUTE", "DELIVERED"]


@pytest.mark.parametrize(
    ("setup", "action", "json"),
    [
        ([], "start", None),  # sem entregador
        ([], "complete", None),  # pendente não pode ser entregue
        (["cancel"], "assign", "deliverer"),  # cancelada é final
        (["assign", "start", "complete"], "cancel", {"reason": "teste"}),  # entregue é final
    ],
)
def test_invalid_transitions_are_rejected(
    client, headers, customer, deliverer, setup, action, json
):
    delivery = new_delivery(client, headers, customer)
    payloads = {
        "assign": {"deliverer_id": str(deliverer.id)},
        "cancel": {"reason": "cliente desistiu"},
    }
    for step in setup:
        assert act(client, headers, delivery, step, payloads.get(step)).status_code == 200
    body = payloads["assign"] if json == "deliverer" else json
    response = act(client, headers, delivery, action, body)
    assert response.status_code == 409
    assert response.json()["error"]["code"] in {"INVALID_TRANSITION", "NO_DELIVERER"}


def test_cancel_requires_reason_and_is_final(client, headers, customer):
    delivery = new_delivery(client, headers, customer)
    assert act(client, headers, delivery, "cancel", {"reason": ""}).status_code == 422
    canceled = act(client, headers, delivery, "cancel", {"reason": "Cliente desistiu"})
    assert canceled.json()["status"] == "CANCELED"
    assert canceled.json()["cancel_reason"] == "Cliente desistiu"
    edit = client.patch(f"{DELIVERIES}/{delivery['id']}", json={"notes": "x"}, headers=headers)
    assert edit.status_code == 409


def test_unassign_returns_to_pending(client, headers, customer, deliverer):
    delivery = new_delivery(client, headers, customer, deliverer_id=str(deliverer.id))
    body = act(client, headers, delivery, "unassign").json()
    assert body["status"] == "PENDING" and body["deliverer"] is None


def test_reassign_is_audited(client, headers, customer, deliverer, make_user, db):
    other = make_user(Role.DELIVERER, phone="5511933334444")
    delivery = new_delivery(client, headers, customer, deliverer_id=str(deliverer.id))
    act(client, headers, delivery, "assign", {"deliverer_id": str(other.id)})
    changes = db.scalars(
        select(AuditLog.details).where(AuditLog.action == AuditAction.DELIVERY_DELIVERER_CHANGED)
    ).all()
    assert changes[-1] == {"from": str(deliverer.id), "to": str(other.id)}


@pytest.mark.parametrize("role", [Role.OPERATOR, Role.ADMIN])
def test_only_deliverers_can_be_assigned(client, headers, customer, make_user, role):
    not_a_deliverer = make_user(role)
    delivery = new_delivery(client, headers, customer)
    response = act(client, headers, delivery, "assign", {"deliverer_id": str(not_a_deliverer.id)})
    assert response.status_code == 404


def test_inactive_deliverer_cannot_be_assigned(client, headers, customer, deliverer, db):
    deliverer.is_active = False
    db.commit()
    delivery = new_delivery(client, headers, customer)
    response = act(client, headers, delivery, "assign", {"deliverer_id": str(deliverer.id)})
    assert response.status_code == 409


# ------------------------------------------------------------------ edição


def test_address_locked_once_in_route(client, headers, customer, deliverer):
    second = client.post(
        f"/api/v1/clients/{customer['id']}/addresses",
        json={"street": "Av. B", "number": "9", "neighborhood": "X", "city": "Y", "state": "SP"},
        headers=headers,
    ).json()
    delivery = new_delivery(client, headers, customer, deliverer_id=str(deliverer.id))
    act(client, headers, delivery, "start")
    response = client.patch(
        f"{DELIVERIES}/{delivery['id']}", json={"client_address_id": second["id"]}, headers=headers
    )
    assert response.status_code == 409
    notes = client.patch(
        f"{DELIVERIES}/{delivery['id']}", json={"notes": "Tocar o interfone"}, headers=headers
    )
    assert notes.status_code == 200


def test_partial_edit_revalidates_change(client, headers, customer):
    delivery = new_delivery(client, headers, customer)  # dinheiro, troco para 100
    response = client.patch(
        f"{DELIVERIES}/{delivery['id']}", json={"payment_method": "PIX"}, headers=headers
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_CHANGE"


# ------------------------------------------------------- acesso e listas


def test_deliverer_cannot_use_management_endpoints(client, auth_headers, deliverer):
    assert client.get(DELIVERIES, headers=auth_headers(deliverer)).status_code == 403


def test_other_company_cannot_see_or_act(
    client, headers, customer, make_user, auth_headers, other_company
):
    delivery = new_delivery(client, headers, customer)
    outsider = auth_headers(make_user(Role.OPERATOR, company=other_company))
    assert client.get(f"{DELIVERIES}/{delivery['id']}", headers=outsider).status_code == 404
    assert act(client, outsider, delivery, "cancel", {"reason": "invasão"}).status_code == 404
    assert client.get(DELIVERIES, headers=outsider).json()["total"] == 0


def test_cannot_assign_deliverer_from_other_company(
    client, headers, customer, make_user, other_company
):
    foreign = make_user(Role.DELIVERER, company=other_company, phone="5511955556666")
    delivery = new_delivery(client, headers, customer)
    response = act(client, headers, delivery, "assign", {"deliverer_id": str(foreign.id)})
    assert response.status_code == 404


def test_filters_and_search(client, headers, customer, deliverer):
    a = new_delivery(client, headers, customer)
    new_delivery(client, headers, customer, deliverer_id=str(deliverer.id))

    def numbers(**params):
        response = client.get(DELIVERIES, params=params, headers=headers)
        return [item["number"] for item in response.json()["items"]]

    assert numbers(status="PENDING") == [a["number"]]
    assert len(numbers(status=["PENDING", "ASSIGNED"])) == 2
    assert numbers(search=f"#{a['number']}") == [a["number"]]
    assert len(numbers(search="98765-4321")) == 2


def test_deliverers_list_shows_load(client, headers, customer, deliverer):
    new_delivery(client, headers, customer, deliverer_id=str(deliverer.id))
    [option] = client.get("/api/v1/deliverers", headers=headers).json()
    assert option["id"] == str(deliverer.id)
    assert option["active_deliveries"] == 1
