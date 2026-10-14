"""Configuração da aplicação, lida de variáveis de ambiente (e do arquivo .env em dev).

Toda configuração passa por aqui. Nenhum outro módulo lê `os.environ` diretamente:
assim os valores são validados uma única vez, na inicialização.
"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # SecretStr evita que a URL (com senha) apareça em logs ou repr().
    database_url: SecretStr
    migrations_database_url: SecretStr | None = None

    cors_origins: Annotated[list[str], NoDecode] = []

    # --- Autenticação ---------------------------------------------------
    # Segredo que assina os JWT. Quem tiver este valor consegue forjar tokens.
    jwt_secret: SecretStr = Field(min_length=32)
    access_token_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_days: int = Field(default=7, ge=1, le=30)

    # Bloqueio progressivo de conta após falhas seguidas de login.
    login_max_failures: int = Field(default=5, ge=3)
    login_lock_minutes: int = Field(default=15, ge=1)

    # Limite por IP (por processo; o Nginx aplica outro limite global em produção).
    login_rate_limit_per_minute: int = Field(default=10, ge=1)

    # Rastreamento (fase 6): por quantos dias guardar as posições dos entregadores.
    # Localização é dado pessoal (LGPD): guardar só o necessário.
    location_retention_days: int = Field(default=30, ge=1, le=365)

    # Senha dos usuários de demonstração criados por `python -m app.cli seed-dev`.
    # Só em desenvolvimento; o comando se recusa a rodar em produção.
    dev_seed_password: SecretStr | None = None

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
