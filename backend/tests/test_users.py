"""Gestão de usuários: RBAC, isolamento entre empresas e regras de negócio."""

import pytest
from sqlalchemy import select

from app.core.permissions import Role
from app.modules.audit.models import AuditAction, AuditLog
from tests.conftest import PASSWORD

USERS = "/api/v1/users"
NEW_PASSWORD = "outra-senha-bem-forte"


def user_payload(**overrides) -> dict:
    return {
        "name": "Carlos Entregador",
        "phone": "(21) 99876-5432",
        "role": "DELIVERER",
        "password": NEW_PASSWORD,
        **overrides,
    }


# ------------------------------------------------------------------ RBAC


@pytest.mark.parametrize("role", [Role.OPERATOR, Role.DELIVERER])
def test_non_admins_cannot_manage_users(client, make_user, auth_headers, role):
    headers = auth_headers(make_user(role))
    assert client.get(USERS, headers=headers).status_code == 403
    assert client.post(USERS, json=user_payload(), headers=headers).status_code == 403


def test_users_endpoints_require_authentication(client):
    assert client.get(USERS).status_code == 401


# ------------------------------------------------- isolamento (IDOR)


def test_admin_only_sees_own_company(client, make_user, auth_headers, other_company):
    admin = make_user(Role.ADMIN)
    colleague = make_user(Role.OPERATOR)
    stranger = make_user(Role.OPERATOR, company=other_company)

    body = client.get(USERS, headers=auth_headers(admin)).json()
    ids = {item["id"] for item in body["items"]}
    assert ids == {str(admin.id), str(colleague.id)}
    assert str(stranger.id) not in ids
    assert body["total"] == 2


def test_admin_cannot_touch_user_from_other_company(client, make_user, auth_headers, other_company):
    headers = auth_headers(make_user(Role.ADMIN))
    stranger = make_user(Role.OPERATOR, company=other_company)
    url = f"{USERS}/{stranger.id}"

    # 404, não 403: nem confirmamos que o registro existe.
    assert client.get(url, headers=headers).status_code == 404
    assert client.patch(url, json={"name": "Hackeado"}, headers=headers).status_code == 404
    reset = client.post(
        f"{url}/reset-password", json={"new_password": NEW_PASSWORD}, headers=headers
    )
    assert reset.status_code == 404


# ------------------------------------------------------------- criação


def test_admin_creates_user_who_can_login(client, make_user, auth_headers, db):
    admin = make_user(Role.ADMIN)
    response = client.post(USERS, json=user_payload(), headers=auth_headers(admin))

    assert response.status_code == 201
    created = response.json()
    assert created["phone"] == "5521998765432"
    assert created["role"] == "DELIVERER"
    assert "password" not in response.text

    login = client.post(
        "/api/v1/auth/login", json={"identifier": "21 99876-5432", "password": NEW_PASSWORD}
    )
    assert login.status_code == 200
    log = db.scalar(select(AuditLog).where(AuditLog.action == AuditAction.USER_CREATED))
    assert log.resource_id == created["id"] and log.user_id == admin.id


def test_mass_assignment_is_rejected(client, make_user, auth_headers, other_company):
    headers = auth_headers(make_user(Role.ADMIN))
    for field, value in (
        ("company_id", str(other_company.id)),
        ("password_hash", "x"),
        ("is_active", False),
    ):
        response = client.post(USERS, json=user_payload(**{field: value}), headers=headers)
        assert response.status_code == 422, field


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"phone": None, "email": None}, ""),
        ({"password": "curta"}, "password"),
        ({"password": "1234567890"}, "password"),
        ({"phone": "123"}, "phone"),
        ({"email": "nao-e-email", "phone": None}, "email"),
        ({"role": "SUPERADMIN"}, "role"),
    ],
)
def test_create_user_validation(client, make_user, auth_headers, overrides, field):
    response = client.post(USERS, json=user_payload(**overrides), headers=auth_headers(make_user()))
    assert response.status_code == 422
    fields = {detail["field"] for detail in response.json()["error"]["details"]}
    assert field in fields


def test_duplicate_contact_is_conflict(client, make_user, auth_headers):
    headers = auth_headers(make_user(Role.ADMIN, email="dono@teste.com"))
    response = client.post(
        USERS, json=user_payload(email="DONO@teste.com", phone=None), headers=headers
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_TAKEN"


# --------------------------------------------------------------- edição


def test_admin_cannot_lock_themselves_out(client, make_user, auth_headers):
    admin = make_user(Role.ADMIN)
    headers = auth_headers(admin)
    url = f"{USERS}/{admin.id}"
    for change in ({"role": "OPERATOR"}, {"is_active": False}):
        response = client.patch(url, json=change, headers=headers)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "SELF_LOCKOUT"


def test_deactivation_revokes_sessions_and_is_audited(client, make_user, auth_headers, db):
    admin = make_user(Role.ADMIN)
    target = make_user(Role.OPERATOR)
    target_headers = auth_headers(target)
    target_cookie = client.cookies.get("despacha_refresh")

    admin_headers = auth_headers(admin)
    response = client.patch(
        f"{USERS}/{target.id}", json={"is_active": False}, headers=admin_headers
    )
    assert response.status_code == 200

    assert client.get("/api/v1/auth/me", headers=target_headers).status_code == 401
    client.cookies.clear()
    refresh = client.post(
        "/api/v1/auth/refresh", headers={"Cookie": f"despacha_refresh={target_cookie}"}
    )
    assert refresh.status_code == 401
    assert db.scalar(
        select(AuditLog).where(
            AuditLog.action == AuditAction.USER_DEACTIVATED,
            AuditLog.resource_id == str(target.id),
        )
    )


def test_role_change_is_audited_with_before_and_after(client, make_user, auth_headers, db):
    admin = make_user(Role.ADMIN)
    target = make_user(Role.DELIVERER)
    response = client.patch(
        f"{USERS}/{target.id}", json={"role": "OPERATOR"}, headers=auth_headers(admin)
    )
    assert response.status_code == 200
    log = db.scalar(select(AuditLog).where(AuditLog.action == AuditAction.USER_ROLE_CHANGED))
    assert log.details == {"from": "DELIVERER", "to": "OPERATOR"}


def test_cannot_remove_last_contact(client, make_user, auth_headers):
    admin = make_user(Role.ADMIN)
    target = make_user(Role.OPERATOR, email="so-email@teste.com")
    response = client.patch(
        f"{USERS}/{target.id}", json={"email": None}, headers=auth_headers(admin)
    )
    assert response.status_code == 409


def test_reset_password_unlocks_and_replaces_old_password(client, make_user, auth_headers, db):
    admin = make_user(Role.ADMIN)
    target = make_user(Role.OPERATOR, email="esqueceu@teste.com")
    target.failed_login_count = 7
    db.commit()

    response = client.post(
        f"{USERS}/{target.id}/reset-password",
        json={"new_password": NEW_PASSWORD},
        headers=auth_headers(admin),
    )
    assert response.status_code == 204
    db.refresh(target)
    assert target.failed_login_count == 0

    old = {"identifier": "esqueceu@teste.com", "password": PASSWORD}
    new = {"identifier": "esqueceu@teste.com", "password": NEW_PASSWORD}
    assert client.post("/api/v1/auth/login", json=old).status_code == 401
    assert client.post("/api/v1/auth/login", json=new).status_code == 200


def test_search_treats_wildcards_literally(client, make_user, auth_headers):
    headers = auth_headers(make_user(Role.ADMIN))
    make_user(Role.OPERATOR)
    body = client.get(USERS, params={"search": "%"}, headers=headers).json()
    assert body["total"] == 0
