"""Fase 9: consulta de auditoria, encerramento de sessões e travas de produção."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.permissions import Role
from app.modules.auth.models import RefreshToken
from app.modules.auth.service import purge_expired_sessions

AUDIT = "/api/v1/audit"
ME = "/api/v1/auth/me"
COOKIE = "despacha_refresh"


def refresh_with(client, raw_token):
    client.cookies.clear()
    return client.post("/api/v1/auth/refresh", headers={"Cookie": f"{COOKIE}={raw_token}"})


# ---------------------------------------------------------------- auditoria


def test_audit_is_admin_only(client, make_user, auth_headers):
    assert client.get(AUDIT, headers=auth_headers(make_user(Role.OPERATOR))).status_code == 403
    assert client.get(AUDIT, headers=auth_headers(make_user(Role.DELIVERER))).status_code == 403


def test_audit_lists_company_events_newest_first(client, make_user, auth_headers, other_company):
    admin = make_user(Role.ADMIN)
    headers = auth_headers(admin)  # login gera auth.login_succeeded
    client.post(
        "/api/v1/users",
        json={
            "name": "Novo",
            "phone": "11955554444",
            "role": "DELIVERER",
            "password": "senha-forte-1234",
        },
        headers=headers,
    )
    outsider = make_user(Role.ADMIN, company=other_company)
    auth_headers(outsider)  # evento da outra empresa

    body = client.get(AUDIT, headers=headers).json()
    actions = [item["action"] for item in body["items"]]
    assert actions[0] == "user.created"
    assert "auth.login_succeeded" in actions
    assert all(
        item["user"] is None or item["user"]["id"] != str(outsider.id) for item in body["items"]
    )
    assert body["items"][0]["user"]["name"] == admin.name

    only_auth = client.get(AUDIT, params={"category": "auth"}, headers=headers).json()
    assert {item["action"].split(".")[0] for item in only_auth["items"]} == {"auth"}


def test_audit_rejects_unknown_category(client, make_user, auth_headers):
    headers = auth_headers(make_user(Role.ADMIN))
    assert client.get(AUDIT, params={"category": "x"}, headers=headers).status_code == 422


# ------------------------------------------------------------------ sessões


def test_logout_all_kills_access_and_refresh_immediately(client, make_user, login):
    user = make_user(Role.OPERATOR)
    token = login(user)["access_token"]
    refresh_cookie = client.cookies.get(COOKIE)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.post("/api/v1/auth/logout-all", headers=headers).status_code == 204
    # Mesmo access token ainda dentro dos 15 min: recusado na hora.
    assert client.get(ME, headers=headers).status_code == 401
    assert refresh_with(client, refresh_cookie).status_code == 401

    # Novo login funciona normalmente.
    assert (
        client.get(
            ME, headers={"Authorization": f"Bearer {login(user)['access_token']}"}
        ).status_code
        == 200
    )


def test_admin_revokes_someone_elses_sessions(client, make_user, auth_headers, other_company):
    admin_headers = auth_headers(make_user(Role.ADMIN))
    deliverer = make_user(Role.DELIVERER, phone="5511911112222")
    deliverer_headers = auth_headers(deliverer)

    response = client.post(f"/api/v1/users/{deliverer.id}/revoke-sessions", headers=admin_headers)
    assert response.status_code == 204
    assert client.get(ME, headers=deliverer_headers).status_code == 401

    stranger = make_user(Role.DELIVERER, company=other_company, phone="5511933334444")
    other = client.post(f"/api/v1/users/{stranger.id}/revoke-sessions", headers=admin_headers)
    assert other.status_code == 404


def test_purge_removes_old_sessions_only(client, make_user, login, db):
    user = make_user()
    login(user)
    login(user)
    old = db.query(RefreshToken).first()
    old.expires_at = datetime.now(UTC) - timedelta(days=30)
    db.commit()
    assert purge_expired_sessions(db, older_than_days=7) == 1
    assert db.query(RefreshToken).count() == 1


# --------------------------------------------------------- travas de produção


@pytest.mark.parametrize(
    "overrides",
    [
        {"cors_origins": "http://inseguro.example"},
        {"dev_seed_password": "algo"},
    ],
)
def test_production_refuses_dangerous_config(overrides):
    base = {"app_env": "production", "database_url": "postgresql://x", "jwt_secret": "s" * 40}
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **base, **overrides)


def test_production_accepts_safe_config():
    settings = Settings(
        _env_file=None,
        app_env="production",
        database_url="postgresql://x",
        jwt_secret="s" * 40,
        cors_origins="https://app.example",
    )
    assert settings.is_production
