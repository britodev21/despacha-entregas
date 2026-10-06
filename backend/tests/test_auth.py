"""Autenticação: login, bloqueio, sessões, tokens e proteções."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from psycopg.errors import InsufficientPrivilege
from sqlalchemy import select, text
from sqlalchemy.exc import ProgrammingError

from app.core.config import get_settings
from app.core.permissions import Role
from app.core.security import JWT_AUDIENCE, JWT_ISSUER
from app.modules.audit.models import AuditAction, AuditLog
from tests.conftest import PASSWORD

LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"
CHANGE_PASSWORD = "/api/v1/auth/change-password"
COOKIE = "despacha_refresh"


def actions(db, user_id=None) -> list[str]:
    stmt = select(AuditLog.action).order_by(AuditLog.id)
    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
    return list(db.scalars(stmt))


def refresh_with(client, raw_token: str):
    """Chama /refresh com um token específico (simula outro navegador)."""
    client.cookies.clear()
    return client.post(REFRESH, headers={"Cookie": f"{COOKIE}={raw_token}"})


def forge_token(user, *, secret=None, algorithm="HS256", **overrides) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "cid": str(user.company_id),
        "role": user.role,
        "typ": "access",
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=5),
        **overrides,
    }
    key = get_settings().jwt_secret.get_secret_value() if secret is None else secret
    return jwt.encode(payload, key, algorithm=algorithm)


# ---------------------------------------------------------------- login


def test_login_with_email_returns_token_and_secure_cookie(client, make_user, db):
    user = make_user(Role.ADMIN, email="ana@teste.com")
    response = client.post(LOGIN, json={"identifier": "  ANA@teste.com ", "password": PASSWORD})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["id"] == str(user.id)
    assert "users:manage" in body["user"]["permissions"]
    assert "password_hash" not in response.text

    cookie = response.headers["set-cookie"]
    for attribute in ("HttpOnly", "Secure", "SameSite=strict", "Path=/api/v1/auth"):
        assert attribute in cookie
    assert AuditAction.AUTH_LOGIN_SUCCEEDED in actions(db, user.id)


def test_login_with_formatted_phone(client, make_user):
    make_user(Role.DELIVERER, phone="5511987654321")
    response = client.post(LOGIN, json={"identifier": "(11) 98765-4321", "password": PASSWORD})
    assert response.status_code == 200
    assert response.json()["user"]["permissions"] == ["deliveries:own", "tracking:send"]


def test_login_failures_are_indistinguishable(client, make_user):
    make_user(email="existe@teste.com")
    unknown = client.post(LOGIN, json={"identifier": "naoexiste@teste.com", "password": "x" * 12})
    wrong = client.post(LOGIN, json={"identifier": "existe@teste.com", "password": "x" * 12})

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["error"]["code"] == wrong.json()["error"]["code"]
    assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]


def test_account_locks_after_repeated_failures(client, make_user, db):
    user = make_user(email="alvo@teste.com")
    for _ in range(get_settings().login_max_failures):
        client.post(LOGIN, json={"identifier": "alvo@teste.com", "password": "errada-123456"})

    db.refresh(user)
    assert user.locked_until is not None and user.locked_until > datetime.now(UTC)

    # Bloqueada: nem a senha correta entra.
    blocked = client.post(LOGIN, json={"identifier": "alvo@teste.com", "password": PASSWORD})
    assert blocked.status_code == 401
    assert AuditAction.AUTH_ACCOUNT_LOCKED in actions(db, user.id)
    assert AuditAction.AUTH_LOGIN_BLOCKED in actions(db, user.id)

    # Bloqueio vencido: entra e o contador zera.
    user.locked_until = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    assert (
        client.post(LOGIN, json={"identifier": "alvo@teste.com", "password": PASSWORD}).status_code
        == 200
    )
    db.refresh(user)
    assert user.failed_login_count == 0


def test_inactive_user_cannot_login(client, make_user):
    user = make_user(is_active=False)
    response = client.post(LOGIN, json={"identifier": user.email, "password": PASSWORD})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_rate_limit_per_ip(client):
    limit = get_settings().login_rate_limit_per_minute
    payload = {"identifier": "ninguem@teste.com", "password": "qualquer-coisa"}
    for _ in range(limit):
        assert client.post(LOGIN, json=payload).status_code == 401
    response = client.post(LOGIN, json=payload)
    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) >= 1


def test_login_rejects_extra_fields(client):
    response = client.post(LOGIN, json={"identifier": "a@b.com", "password": "x", "role": "ADMIN"})
    assert response.status_code == 422


# --------------------------------------------------------------- sessões


def test_refresh_rotates_and_detects_reuse(client, make_user, login, db):
    user = make_user()
    login(user)
    first = client.cookies.get(COOKIE)

    rotated = client.post(REFRESH)
    assert rotated.status_code == 200
    second = client.cookies.get(COOKIE)
    assert second and second != first

    # Alguém reapresenta o token antigo (roubado): recusado...
    assert refresh_with(client, first).status_code == 401
    # ...e a família inteira cai, inclusive o token legítimo mais novo.
    assert refresh_with(client, second).status_code == 401
    assert AuditAction.AUTH_REFRESH_REUSE_DETECTED in actions(db, user.id)


def test_refresh_without_cookie_is_rejected_and_cookie_cleared(client):
    response = client.post(REFRESH)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SESSION_INVALID"
    assert f'{COOKIE}=""' in response.headers["set-cookie"]


def test_refresh_rejects_foreign_origin(client, make_user, login):
    login(make_user())
    response = client.post(REFRESH, headers={"Origin": "https://site-malicioso.example"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_NOT_ALLOWED"


def test_logout_revokes_session(client, make_user, login, db):
    user = make_user()
    login(user)
    token = client.cookies.get(COOKIE)

    assert client.post(LOGOUT).status_code == 204
    assert refresh_with(client, token).status_code == 401
    assert AuditAction.AUTH_LOGOUT in actions(db, user.id)


# ---------------------------------------------------------------- tokens


def test_me_requires_authentication(client):
    response = client.get(ME)
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "case",
    ["expired", "wrong_secret", "wrong_audience", "refresh_type", "garbage", "alg_none"],
)
def test_invalid_access_tokens_are_rejected(client, make_user, case):
    user = make_user()
    past = datetime.now(UTC) - timedelta(minutes=10)
    token = {
        "expired": lambda: forge_token(user, iat=past, exp=past + timedelta(minutes=1)),
        "wrong_secret": lambda: forge_token(user, secret="x" * 40),
        "wrong_audience": lambda: forge_token(user, aud="outro-sistema"),
        "refresh_type": lambda: forge_token(user, typ="refresh"),
        "garbage": lambda: "nao.e.um.jwt",
        "alg_none": lambda: forge_token(user, algorithm="none", secret=""),
    }[case]()
    response = client.get(ME, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_INVALID"


def test_deactivated_user_token_stops_working_immediately(client, make_user, auth_headers, db):
    user = make_user()
    headers = auth_headers(user)
    assert client.get(ME, headers=headers).status_code == 200

    user.is_active = False
    db.commit()
    assert client.get(ME, headers=headers).status_code == 401


def test_change_password_revokes_other_sessions_and_old_tokens(client, make_user, db):
    user = make_user(email="troca@teste.com")
    credentials = {"identifier": "troca@teste.com", "password": PASSWORD}

    # Sessão no "celular perdido"
    client.post(LOGIN, json=credentials)
    other_session = client.cookies.get(COOKIE)
    # Access token antigo (emitido antes da troca)
    old_token = forge_token(user, iat=datetime.now(UTC) - timedelta(minutes=1))

    # Sessão atual, que faz a troca
    client.cookies.clear()
    current = client.post(LOGIN, json=credentials).json()
    current_cookie = client.cookies.get(COOKIE)
    response = client.post(
        CHANGE_PASSWORD,
        json={"current_password": PASSWORD, "new_password": "nova-senha-bem-forte"},
        headers={"Authorization": f"Bearer {current['access_token']}"},
    )
    assert response.status_code == 200
    new_token = response.json()["access_token"]

    assert client.get(ME, headers={"Authorization": f"Bearer {new_token}"}).status_code == 200
    assert client.get(ME, headers={"Authorization": f"Bearer {old_token}"}).status_code == 401
    assert refresh_with(client, other_session).status_code == 401
    assert refresh_with(client, current_cookie).status_code == 200
    assert AuditAction.AUTH_PASSWORD_CHANGED in actions(db, user.id)


def test_change_password_requires_correct_current_password(client, make_user, auth_headers):
    user = make_user()
    response = client.post(
        CHANGE_PASSWORD,
        json={"current_password": "errada-errada", "new_password": "nova-senha-bem-forte"},
        headers=auth_headers(user),
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "WRONG_CURRENT_PASSWORD"


# ------------------------------------------------------------- auditoria


def test_audit_log_is_append_only_for_app_role(db, company):
    db.add(AuditLog(action="teste.append_only", company_id=company.id))
    db.flush()
    for statement in (
        "UPDATE audit_logs SET action = 'adulterado'",
        "DELETE FROM audit_logs",
    ):
        with pytest.raises(ProgrammingError) as exc_info:
            db.execute(text(statement))
        assert isinstance(exc_info.value.orig, InsufficientPrivilege)
        db.rollback()


def test_failed_login_audit_has_no_secrets(client, make_user, db):
    user = make_user(email="vitima@teste.com")
    client.post(LOGIN, json={"identifier": "vitima@teste.com", "password": "senha-tentada-123"})
    log = db.scalar(
        select(AuditLog).where(
            AuditLog.user_id == user.id, AuditLog.action == AuditAction.AUTH_LOGIN_FAILED
        )
    )
    assert log is not None
    assert "senha-tentada-123" not in str(log.details)
    assert log.ip is not None


def test_unknown_user_id_in_valid_token_is_rejected(client, make_user):
    token = forge_token(make_user(), sub=str(uuid.uuid4()))  # assinatura válida, id inexistente
    assert client.get(ME, headers={"Authorization": f"Bearer {token}"}).status_code == 401
