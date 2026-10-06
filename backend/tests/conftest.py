"""Infraestrutura de testes.

Estratégia:
- Banco PostgreSQL real e separado (TEST_*_DATABASE_URL). SQLite se comporta
  diferente (JSONB, constraints, locks) e esconderia bugs.
- No início da sessão: apaga tudo e roda as migrations do zero — testa as
  migrations de verdade.
- Cada teste roda dentro de uma transação que sofre rollback no final:
  testes não deixam lixo e não dependem uns dos outros.
"""

import os
from pathlib import Path

from dotenv import dotenv_values

# Precisa acontecer ANTES de importar a aplicação: a configuração é lida no import.
_env = {**dotenv_values(Path(__file__).parents[1] / ".env"), **os.environ}
for _key in ("TEST_DATABASE_URL", "TEST_MIGRATIONS_DATABASE_URL"):
    if not _env.get(_key):
        raise RuntimeError(f"Defina {_key} no .env para rodar os testes.")
    if not _env[_key].rsplit("/", 1)[-1].endswith("_test"):
        # Proteção: os testes APAGAM o banco. Nunca apontar para dev/produção.
        raise RuntimeError(f"{_key} deve apontar para um banco cujo nome termina com _test.")
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = _env["TEST_DATABASE_URL"]
os.environ["MIGRATIONS_DATABASE_URL"] = _env["TEST_MIGRATIONS_DATABASE_URL"]

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.db import engine, get_db  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = Path(__file__).parents[1]


def _reset_schema() -> None:
    """Remove todas as tabelas do banco de teste (como dono do schema)."""
    owner_engine = create_engine(os.environ["MIGRATIONS_DATABASE_URL"])
    with owner_engine.begin() as conn:
        tables = conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        ).scalars()
        for table in tables:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
    owner_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _database() -> None:
    _reset_schema()
    config = Config(toml_file=str(BACKEND_DIR / "pyproject.toml"))
    command.upgrade(config, "head")


@pytest.fixture
def db() -> Session:
    connection = engine.connect()
    transaction = connection.begin()
    # create_savepoint: commits feitos pelo código testado viram SAVEPOINTs,
    # e tudo é desfeito no rollback final.
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db: Session) -> TestClient:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
