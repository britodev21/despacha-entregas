from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import get_settings
from app.models import Base

config = context.config

if config.config_file_name is not None:
    # disable_existing_loggers=False: não silenciar os loggers da aplicação
    # quando as migrations rodam dentro dos testes.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def _migrations_url() -> str:
    # Migrations rodam com o usuário DONO do schema (pode criar/alterar tabelas).
    # A API usa outro usuário, sem esse poder. Ver scripts/setup_db.sql.
    url = get_settings().migrations_database_url
    if url is None:
        raise RuntimeError("Defina MIGRATIONS_DATABASE_URL no .env para rodar migrations.")
    return url.get_secret_value()


def run_migrations_offline() -> None:
    """Gera o SQL sem conectar no banco (`alembic upgrade head --sql`)."""
    context.configure(
        url=_migrations_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_migrations_url(), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
