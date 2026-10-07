"""Clientes e endereços: CRUD, validações, isolamento e regras."""

import pytest
from sqlalchemy import select

from app.core.permissions import Role
from app.modules.audit.models import AuditAction, AuditLog

CLIENTS = "/api/v1/clients"


def address(**overrides) -> dict:
    return {
        "zip_code": "01310-100",
        "street": "Avenida Paulista",
        "number": "1000",
        "neighborhood": "Bela Vista",
        "city": "São Paulo",
        "state": "sp",
        "reference": "Em frente à banca",
        **overrides,
    }


@pytest.fixture
def operator_headers(make_user, auth_headers):
    return auth_headers(make_user(Role.OPERATOR))


def create(client, headers, **overrides) -> dict:
    payload = {"name": "Maria Souza", "phone": "(11) 98765-4321", **overrides}
    response = client.post(CLIENTS, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


# ------------------------------------------------------------- acesso


def test_deliverer_cannot_access_clients(client, make_user, auth_headers):
    headers = auth_headers(make_user(Role.DELIVERER))
    assert client.get(CLIENTS, headers=headers).status_code == 403


def test_client_from_other_company_is_invisible(client, make_user, auth_headers, other_company):
    outsider = auth_headers(make_user(Role.OPERATOR, company=other_company))
    mine = create(client, auth_headers(make_user(Role.OPERATOR)), addresses=[address()])
    url = f"{CLIENTS}/{mine['id']}"
    address_url = f"{url}/addresses/{mine['addresses'][0]['id']}"

    assert client.get(url, headers=outsider).status_code == 404
    assert client.patch(url, json={"name": "X"}, headers=outsider).status_code == 404
    assert client.delete(address_url, headers=outsider).status_code == 404
    assert client.get(CLIENTS, headers=outsider).json()["total"] == 0


# ------------------------------------------------------------- criação


def test_create_client_with_address_normalizes_fields(client, operator_headers, db):
    body = create(
        client,
        operator_headers,
        document="529.982.247-25",
        email="MARIA@Exemplo.com",
        addresses=[address()],
    )
    assert body["phone"] == "5511987654321"
    assert body["document"] == "52998224725"
    assert body["email"] == "maria@exemplo.com"
    [addr] = body["addresses"]
    assert addr["zip_code"] == "01310100"
    assert addr["state"] == "SP"
    assert addr["is_default"] is True  # único endereço vira o principal
    assert db.scalar(select(AuditLog).where(AuditLog.action == AuditAction.CLIENT_CREATED))


def test_only_name_is_required(client, operator_headers):
    body = create(client, operator_headers, phone=None)
    assert body["phone"] is None and body["addresses"] == []


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"name": "  "}, "name"),
        ({"document": "111.111.111-11"}, "document"),
        ({"phone": "123"}, "phone"),
        ({"addresses": [address(state="XX")]}, "addresses.0.state"),
        ({"addresses": [address(zip_code="123")]}, "addresses.0.zip_code"),
        ({"addresses": [address(street="")]}, "addresses.0.street"),
        ({"company_id": "00000000-0000-0000-0000-000000000000"}, "company_id"),
    ],
)
def test_create_client_validation(client, operator_headers, overrides, field):
    payload = {"name": "Maria", **overrides}
    response = client.post(CLIENTS, json=payload, headers=operator_headers)
    assert response.status_code == 422
    assert field in {d["field"] for d in response.json()["error"]["details"]}


def test_list_hides_document(client, operator_headers):
    create(client, operator_headers, document="529.982.247-25")
    item = client.get(CLIENTS, headers=operator_headers).json()["items"][0]
    assert "document" not in item


# ---------------------------------------------------------------- busca


def test_search_by_name_or_phone_digits(client, operator_headers):
    create(client, operator_headers, name="Maria Souza", phone="(11) 98765-4321")
    create(client, operator_headers, name="João Lima", phone="(21) 91234-5678")

    def names(search: str) -> list[str]:
        response = client.get(CLIENTS, params={"search": search}, headers=operator_headers)
        return [item["name"] for item in response.json()["items"]]

    assert names("maria") == ["Maria Souza"]
    assert names("98765-4321") == ["Maria Souza"]
    assert names("(21) 9123") == ["João Lima"]
    assert names("%") == []


def test_archived_clients_hidden_by_default(client, operator_headers):
    body = create(client, operator_headers)
    client.patch(f"{CLIENTS}/{body['id']}", json={"is_active": False}, headers=operator_headers)
    assert client.get(CLIENTS, headers=operator_headers).json()["total"] == 0
    all_items = client.get(CLIENTS, params={"include_inactive": True}, headers=operator_headers)
    assert all_items.json()["total"] == 1


# ------------------------------------------------------------ endereços


def test_single_default_address(client, operator_headers):
    body = create(client, operator_headers, addresses=[address(label="Casa")])
    url = f"{CLIENTS}/{body['id']}/addresses"

    work = client.post(
        url, json=address(label="Trabalho", is_default=True), headers=operator_headers
    )
    assert work.status_code == 201

    addresses = client.get(f"{CLIENTS}/{body['id']}", headers=operator_headers).json()["addresses"]
    defaults = [a["label"] for a in addresses if a["is_default"]]
    assert defaults == ["Trabalho"]
    assert addresses[0]["label"] == "Trabalho"  # principal vem primeiro


def test_deleting_default_promotes_another(client, operator_headers):
    body = create(
        client, operator_headers, addresses=[address(label="Casa"), address(label="Trabalho")]
    )
    default = next(a for a in body["addresses"] if a["is_default"])
    response = client.delete(
        f"{CLIENTS}/{body['id']}/addresses/{default['id']}", headers=operator_headers
    )
    assert response.status_code == 204
    [remaining] = client.get(f"{CLIENTS}/{body['id']}", headers=operator_headers).json()[
        "addresses"
    ]
    assert remaining["is_default"] is True


def test_address_must_belong_to_client_in_url(client, operator_headers):
    first = create(client, operator_headers, addresses=[address()])
    second = create(client, operator_headers, name="Outro")
    foreign_address = first["addresses"][0]["id"]
    # Endereço do cliente A acessado pela URL do cliente B: não existe.
    response = client.patch(
        f"{CLIENTS}/{second['id']}/addresses/{foreign_address}",
        json={"number": "1"},
        headers=operator_headers,
    )
    assert response.status_code == 404


def test_update_address_partial(client, operator_headers):
    body = create(client, operator_headers, addresses=[address()])
    url = f"{CLIENTS}/{body['id']}/addresses/{body['addresses'][0]['id']}"
    response = client.patch(
        url, json={"number": "1500", "complement": "Apto 42"}, headers=operator_headers
    )
    assert response.status_code == 200
    assert response.json()["number"] == "1500"
    assert response.json()["street"] == "Avenida Paulista"
    assert client.patch(url, json={"street": None}, headers=operator_headers).status_code == 422
