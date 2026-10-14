"""Rastreamento: privacidade aplicada no servidor, isolamento e retenção."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.core.permissions import Role
from app.modules.tracking import router as tracking_router
from app.modules.tracking.models import DelivererLocation
from app.modules.tracking.service import count_locations, purge_old_locations

LOCATION = "/api/v1/me/location"
POINT = {"lat": "-23.561684", "lng": "-46.655981", "accuracy_m": "12.5"}


@pytest.fixture(autouse=True)
def _reset_location_limiter():
    tracking_router._location_limiter.reset()


@pytest.fixture
def operator_headers(make_user, auth_headers):
    return auth_headers(make_user(Role.OPERATOR))


@pytest.fixture
def deliverer(make_user):
    return make_user(Role.DELIVERER, phone="5511911112222")


@pytest.fixture
def me(auth_headers, deliverer):
    return auth_headers(deliverer)


@pytest.fixture
def delivery(client, operator_headers, deliverer):
    customer = client.post(
        "/api/v1/clients",
        json={
            "name": "Maria",
            "addresses": [
                {"street": "Rua A", "number": "1", "neighborhood": "B", "city": "C", "state": "SP"}
            ],
        },
        headers=operator_headers,
    ).json()
    return client.post(
        "/api/v1/deliveries",
        json={
            "client_id": customer["id"],
            "client_address_id": customer["addresses"][0]["id"],
            "deliverer_id": str(deliverer.id),
        },
        headers=operator_headers,
    ).json()


def start(client, me, delivery):
    response = client.post(f"/api/v1/me/deliveries/{delivery['id']}/start", headers=me)
    assert response.status_code == 200


def test_location_discarded_outside_operation(client, me, delivery, db):
    # Só atribuída, ainda não saiu: não rastreia.
    assert client.get("/api/v1/me/tracking", headers=me).json() == {"tracking": False}
    response = client.post(LOCATION, json=POINT, headers=me)
    assert response.status_code == 200
    assert response.json() == {"tracking": False}
    assert count_locations(db) == 0


def test_location_recorded_while_in_route(client, me, delivery, db):
    start(client, me, delivery)
    assert client.get("/api/v1/me/tracking", headers=me).json() == {"tracking": True}
    assert client.post(LOCATION, json=POINT, headers=me).json() == {"tracking": True}
    assert count_locations(db) == 1


def test_tracking_stops_after_delivery(client, me, delivery, db):
    start(client, me, delivery)
    client.post(f"/api/v1/me/deliveries/{delivery['id']}/complete", json={}, headers=me)
    assert client.post(LOCATION, json=POINT, headers=me).json() == {"tracking": False}


def test_wrong_phone_clock_uses_server_time(client, me, delivery, db):
    start(client, me, delivery)
    future = (datetime.now(UTC) + timedelta(days=3)).isoformat()
    client.post(LOCATION, json={**POINT, "recorded_at": future}, headers=me)
    location = db.query(DelivererLocation).one()
    assert location.recorded_at <= datetime.now(UTC) + timedelta(minutes=1)


@pytest.mark.parametrize(
    "body",
    [
        {"lat": "91", "lng": "0"},
        {"lat": "0", "lng": "-181"},
        {"lat": "0"},
        {**POINT, "user_id": "x"},
    ],
)
def test_invalid_location_payload(client, me, delivery, body):
    start(client, me, delivery)
    assert client.post(LOCATION, json=body, headers=me).status_code == 422


def test_location_rate_limited(client, me, delivery):
    start(client, me, delivery)
    for _ in range(12):
        assert client.post(LOCATION, json=POINT, headers=me).status_code == 200
    assert client.post(LOCATION, json=POINT, headers=me).status_code == 429


def test_operator_cannot_send_and_deliverer_cannot_watch(client, operator_headers, me):
    assert client.post(LOCATION, json=POINT, headers=operator_headers).status_code == 403
    assert client.get("/api/v1/tracking/deliverers", headers=me).status_code == 403


def test_operator_sees_latest_position_and_current_delivery(
    client, operator_headers, me, delivery, deliverer
):
    start(client, me, delivery)
    client.post(LOCATION, json={"lat": "-23.5", "lng": "-46.6"}, headers=me)
    client.post(LOCATION, json=POINT, headers=me)

    [entry] = client.get("/api/v1/tracking/deliverers", headers=operator_headers).json()
    assert entry["id"] == str(deliverer.id)
    assert entry["in_route"] == 1
    assert entry["current_delivery"]["number"] == delivery["number"]
    assert entry["last_location"]["lat"] == "-23.561684"


def test_other_company_sees_nothing(client, me, delivery, make_user, auth_headers, other_company):
    start(client, me, delivery)
    client.post(LOCATION, json=POINT, headers=me)
    outsider = auth_headers(make_user(Role.OPERATOR, company=other_company))
    assert client.get("/api/v1/tracking/deliverers", headers=outsider).json() == []
    trail = client.get(f"/api/v1/tracking/deliveries/{delivery['id']}/trail", headers=outsider)
    assert trail.status_code == 404


def test_delivery_trail(client, operator_headers, me, delivery):
    start(client, me, delivery)
    client.post(LOCATION, json=POINT, headers=me)
    trail = client.get(
        f"/api/v1/tracking/deliveries/{delivery['id']}/trail", headers=operator_headers
    ).json()
    assert len(trail) == 1 and trail[0]["lng"] == "-46.655981"


def test_purge_removes_only_old_points(client, me, delivery, db):
    start(client, me, delivery)
    client.post(LOCATION, json=POINT, headers=me)
    client.post(LOCATION, json=POINT, headers=me)
    # Envelhece um dos pontos.
    first_id = db.query(DelivererLocation.id).order_by(DelivererLocation.id).first()[0]
    db.execute(
        update(DelivererLocation)
        .where(DelivererLocation.id == first_id)
        .values(recorded_at=datetime.now(UTC) - timedelta(days=40))
    )
    db.commit()
    assert purge_old_locations(db, days=30) == 1
    assert count_locations(db) == 1
