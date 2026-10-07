"""Testes da fundação: health, formato de erro, headers e companies."""

import pytest
from fastapi import APIRouter, Body
from psycopg.errors import InsufficientPrivilege
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.main import app
from app.modules.companies.service import create_company

# Rotas usadas só nos testes, para exercitar os handlers de erro.
_test_router = APIRouter(prefix="/api/v1/_test")


@_test_router.get("/boom")
def _boom() -> None:
    raise RuntimeError("detalhe interno que não pode vazar")


@_test_router.post("/echo")
def _echo(password: str = Body(min_length=50, embed=True)) -> dict:
    return {"ok": True}


app.include_router(_test_router)


def test_health_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_security_headers_and_request_id(client):
    response = client.get("/api/v1/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Cache-Control"] == "no-store"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]
    assert len(response.headers["X-Request-ID"]) == 32


def test_unknown_route_uses_error_format(client):
    response = client.get("/api/v1/nao-existe")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "NOT_FOUND"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_unexpected_error_does_not_leak_details(client):
    response = client.get("/api/v1/_test/boom")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "detalhe interno" not in response.text
    assert "Traceback" not in response.text
    # Mesmo no erro 500 os headers de segurança estão presentes.
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_validation_error_does_not_echo_input(client):
    secret = "minha-senha-super-secreta"
    response = client.post("/api/v1/_test/echo", json={"password": secret})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["details"][0]["field"] == "password"
    assert secret not in response.text


def test_create_company_defaults(db: Session):
    company = create_company(db, name="  Pizzaria Teste  ")
    assert company.name == "Pizzaria Teste"
    assert company.timezone == "America/Sao_Paulo"
    assert company.next_delivery_number == 1
    assert company.settings == {}
    assert company.is_active is True
    assert company.id.version == 7


@pytest.mark.parametrize(("name", "timezone"), [("   ", "America/Sao_Paulo"), ("X", "Mars/Base")])
def test_create_company_rejects_invalid_input(db: Session, name, timezone):
    with pytest.raises(AppError):
        create_company(db, name=name, timezone=timezone)


def test_app_role_cannot_change_schema(db: Session):
    # A API conecta com um usuário sem permissão de DDL (menor privilégio).
    with pytest.raises(ProgrammingError) as exc_info:
        db.execute(text("CREATE TABLE invasor (id int)"))
    # Checa o tipo do erro, não o texto: a mensagem muda com o idioma do PostgreSQL.
    assert isinstance(exc_info.value.orig, InsufficientPrivilege)


def test_models_and_migrations_are_in_sync():
    """Falha se alguém mudar um model e esquecer de gerar a migration."""
    from alembic import command
    from alembic.config import Config

    from tests.conftest import BACKEND_DIR

    command.check(Config(toml_file=str(BACKEND_DIR / "pyproject.toml")))
