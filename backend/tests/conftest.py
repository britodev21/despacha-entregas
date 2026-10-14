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
import tempfile
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
# Uploads dos testes numa pasta temporária, nunca dentro do projeto.
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="despacha-test-uploads-")
os.environ["DATABASE_URL"] = _env["TEST_DATABASE_URL"]
os.environ["MIGRATIONS_DATABASE_URL"] = _env["TEST_MIGRATIONS_DATABASE_URL"]

import uuid  # noqa: E402
from datetime import UTC, datetime, timedelta  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.db import engine, get_db  # noqa: E402
from app.core.permissions import Role  # noqa: E402
from app.core.rate_limit import login_limiter, refresh_limiter  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.companies.models import Company  # noqa: E402
from app.modules.companies.service import create_company  # noqa: E402
from app.modules.users.models import User  # noqa: E402

PASSWORD = "senha-de-teste-forte-123"

BACKEND_DIR = Path(__file__).parents[1]


def _reset_schema() -> None:
    """Remove todas as tabelas do banco de teste (como dono do schema)."""
    owner_engine = create_engine(os.environ["MIGRATIONS_DATABASE_URL"])
    with owner_engine.begin() as conn:
        tables = (
            conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
            .scalars()
            .all()
        )
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
    def _get_db():
        # Igual à sessão real: erro na requisição desfaz o que não foi commitado.
        try:
            yield db
        except Exception:
            db.rollback()
            raise

    app.dependency_overrides[get_db] = _get_db
    # https: o cookie de refresh é Secure e só é devolvido em conexões HTTPS.
    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_rate_limits() -> None:
    # Os limitadores vivem em memória; cada teste começa do zero.
    login_limiter.reset()
    refresh_limiter.reset()


# ------------------------------------------------------------- fábricas


@pytest.fixture
def company(db: Session) -> Company:
    return create_company(db, name="Empresa A")


@pytest.fixture
def other_company(db: Session) -> Company:
    return create_company(db, name="Empresa B")


@pytest.fixture
def make_user(db: Session, company: Company):
    def _make(
        role: Role = Role.ADMIN,
        *,
        email: str | None = None,
        phone: str | None = None,
        company: Company = company,
        is_active: bool = True,
        password: str = PASSWORD,
    ) -> User:
        if email is None and phone is None:
            email = f"{uuid.uuid4().hex[:10]}@teste.com"
        user = User(
            company_id=company.id,
            name=f"Usuário {role.value.title()}",
            email=email,
            phone=phone,
            role=role,
            password_hash=hash_password(password),
            is_active=is_active,
            # No passado: tokens criados durante o teste ficam depois dela.
            password_changed_at=datetime.now(UTC) - timedelta(hours=1),
        )
        db.add(user)
        db.commit()
        return user

    return _make


@pytest.fixture
def login(client: TestClient):
    """Faz login e devolve o JSON da resposta (cookie fica no client)."""

    def _login(user: User, password: str = PASSWORD) -> dict:
        response = client.post(
            "/api/v1/auth/login",
            json={"identifier": user.email or user.phone, "password": password},
        )
        assert response.status_code == 200, response.text
        return response.json()

    return _login


@pytest.fixture
def auth_headers(login):
    def _headers(user: User) -> dict[str, str]:
        return {"Authorization": f"Bearer {login(user)['access_token']}"}

    return _headers
