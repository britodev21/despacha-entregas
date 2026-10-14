"""Comandos administrativos da plataforma.

Não existe cadastro público de empresas (reduz superfície de ataque).
O dono da plataforma cria empresas e o primeiro admin pela linha de comando:

    uv run python -m app.cli create-company --name "Pizzaria Exemplo"
    uv run python -m app.cli create-user --company-id <ID> --name "Ana" \
        --email ana@exemplo.com --role ADMIN

A senha é pedida no terminal (sem eco) ou lida da entrada padrão com
--password-stdin. Nunca como argumento: ficaria no histórico do shell e
visível na lista de processos.
"""

import argparse
import getpass
import sys
import uuid

from pydantic import ValidationError
from sqlalchemy import or_, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.errors import AppError
from app.core.permissions import Role
from app.modules.companies.models import DEFAULT_TIMEZONE, Company
from app.modules.companies.service import create_company
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate
from app.modules.users.service import create_user


def _create_company(args: argparse.Namespace) -> None:
    with SessionLocal() as db:
        company = create_company(db, name=args.name, timezone=args.timezone)
    print(f"Empresa criada: {company.name} ({company.id})")


def _read_password(from_stdin: bool) -> str:
    if from_stdin:
        return sys.stdin.readline().rstrip("\n")
    password = getpass.getpass("Senha: ")
    if password != getpass.getpass("Confirme a senha: "):
        raise AppError("As senhas não conferem.")
    return password


def _create_user(args: argparse.Namespace) -> None:
    password = _read_password(args.password_stdin)
    try:
        data = UserCreate(
            name=args.name, email=args.email, phone=args.phone, role=args.role, password=password
        )
    except ValidationError as exc:
        raise AppError("; ".join(err["msg"] for err in exc.errors())) from None

    with SessionLocal() as db:
        company = db.get(Company, args.company_id)
        if company is None:
            raise AppError("Empresa não encontrada.")
        # A CLI age "em nome" de um ator de sistema da própria empresa.
        actor = _SystemActor(company_id=company.id)
        user = create_user(db, actor, data)
    print(f"Usuário criado: {user.name} ({user.role}) — {user.id}")


# Domínio example.com: reservado para exemplos (RFC 2606), nunca é de alguém.
_DEMO_COMPANY = "Empresa Demo"
_DEMO_USERS = (
    {"name": "Ana Admin", "email": "admin@demo.example.com", "role": Role.ADMIN},
    {"name": "Otávio Operador", "email": "operador@demo.example.com", "role": Role.OPERATOR},
    {"name": "Edu Entregador", "phone": "(11) 90000-0001", "role": Role.DELIVERER},
)


def _seed_dev(_: argparse.Namespace) -> None:
    """Cria empresa e usuários de demonstração (idempotente). Só em dev."""
    settings = get_settings()
    if settings.is_production:
        raise AppError("seed-dev não pode rodar em produção.")
    if settings.dev_seed_password is None:
        raise AppError("Defina DEV_SEED_PASSWORD no .env.")
    password = settings.dev_seed_password.get_secret_value()

    with SessionLocal() as db:
        company = db.scalar(select(Company).where(Company.name == _DEMO_COMPANY))
        if company is None:
            company = create_company(db, name=_DEMO_COMPANY)
        actor = _SystemActor(company_id=company.id)
        for spec in _DEMO_USERS:
            data = UserCreate(**spec, password=password)
            # Só compara o que foi informado: `User.phone == None` viraria
            # "phone IS NULL" e casaria com qualquer usuário sem telefone.
            contacts = [
                column == value
                for column, value in ((User.email, data.email), (User.phone, data.phone))
                if value
            ]
            exists = db.scalar(select(User.id).where(or_(*contacts)))
            if exists:
                print(f"Já existe: {data.name}")
                continue
            create_user(db, actor, data)
            print(f"Criado: {data.name} ({data.role}) — login: {data.email or data.phone}")
    print("Senha de todos: valor de DEV_SEED_PASSWORD no .env")


def _purge_locations(args: argparse.Namespace) -> None:
    """Apaga posições antigas (LGPD). Agendado diariamente em produção (fase 10)."""
    from app.modules.tracking.service import purge_old_locations

    days = args.days or get_settings().location_retention_days
    with SessionLocal() as db:
        deleted = purge_old_locations(db, days)
    print(f"Posições com mais de {days} dias apagadas: {deleted}")


class _SystemActor:
    """Ator usado pela CLI: auditoria registra user_id vazio (ação de sistema)."""

    def __init__(self, company_id: uuid.UUID) -> None:
        self.company_id = company_id
        self.id = None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    cmd = commands.add_parser("create-company", help="Cria uma nova empresa (tenant)")
    cmd.add_argument("--name", required=True)
    cmd.add_argument("--timezone", default=DEFAULT_TIMEZONE)
    cmd.set_defaults(handler=_create_company)

    cmd = commands.add_parser("create-user", help="Cria um usuário numa empresa")
    cmd.add_argument("--company-id", required=True, type=uuid.UUID)
    cmd.add_argument("--name", required=True)
    cmd.add_argument("--email")
    cmd.add_argument("--phone")
    cmd.add_argument("--role", required=True, choices=[r.value for r in Role])
    cmd.add_argument("--password-stdin", action="store_true", help="Lê a senha da entrada padrão")
    cmd.set_defaults(handler=_create_user)

    cmd = commands.add_parser("purge-locations", help="Apaga posições antigas dos entregadores")
    cmd.add_argument("--days", type=int, help="Padrão: LOCATION_RETENTION_DAYS (30)")
    cmd.set_defaults(handler=_purge_locations)

    cmd = commands.add_parser("seed-dev", help="Cria dados de demonstração (só desenvolvimento)")
    cmd.set_defaults(handler=_seed_dev)

    args = parser.parse_args(argv)
    try:
        args.handler(args)
    except AppError as exc:
        print(f"Erro: {exc.message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
