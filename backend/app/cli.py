"""Comandos administrativos da plataforma.

Não existe cadastro público de empresas (reduz superfície de ataque).
O dono da plataforma cria empresas pela linha de comando, no servidor:

    uv run python -m app.cli create-company --name "Pizzaria Exemplo"
"""

import argparse
import sys

from app.core.db import SessionLocal
from app.core.errors import AppError
from app.modules.companies.models import DEFAULT_TIMEZONE
from app.modules.companies.service import create_company


def _create_company(args: argparse.Namespace) -> None:
    with SessionLocal() as db:
        company = create_company(db, name=args.name, timezone=args.timezone)
    print(f"Empresa criada: {company.name} ({company.id})")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    cmd = commands.add_parser("create-company", help="Cria uma nova empresa (tenant)")
    cmd.add_argument("--name", required=True)
    cmd.add_argument("--timezone", default=DEFAULT_TIMEZONE)
    cmd.set_defaults(handler=_create_company)

    args = parser.parse_args(argv)
    try:
        args.handler(args)
    except AppError as exc:
        print(f"Erro: {exc.message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
