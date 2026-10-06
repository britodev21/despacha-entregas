"""Primitivas criptográficas: senhas, access token (JWT) e refresh token.

Por que dois algoritmos de hash diferentes?
- Senha (escolhida por humanos, baixa entropia): Argon2id, propositalmente
  LENTO e caro em memória, para tornar ataque de força bruta inviável.
- Refresh token (256 bits aleatórios): SHA-256, rápido. Não existe força bruta
  possível contra 256 bits; um hash lento só gastaria CPU à toa.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import get_settings

# Parâmetros mínimos recomendados pela OWASP para Argon2id (19 MiB, 2 iterações).
# O padrão da biblioteca usa 64 MiB por hash: com dezenas de logins
# simultâneos isso esgotaria a memória de um VPS pequeno (vetor de DoS).
_password_hash = PasswordHash((Argon2Hasher(memory_cost=19_456, time_cost=2, parallelism=1),))

# Hash de uma senha qualquer, usado quando o usuário não existe: o login
# demora o mesmo tempo nos dois casos, e o atacante não descobre pelo tempo
# de resposta quais e-mails estão cadastrados.
_DUMMY_HASH = _password_hash.hash("despacha-senha-ficticia-para-tempo-constante")

JWT_ALGORITHM = "HS256"
JWT_ISSUER = "despacha"
JWT_AUDIENCE = "despacha-api"


# ---------------------------------------------------------------- senhas


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> tuple[bool, str | None]:
    """Retorna (válida, novo_hash). novo_hash vem preenchido quando os
    parâmetros do Argon2 mudaram e o hash salvo deve ser atualizado."""
    return _password_hash.verify_and_update(password, password_hash)


def burn_password_check(password: str) -> None:
    """Gasta o mesmo tempo de uma verificação real (ver _DUMMY_HASH)."""
    _password_hash.verify(password, _DUMMY_HASH)


# ---------------------------------------------------------- access token


def create_access_token(*, user_id: uuid.UUID, company_id: uuid.UUID, role: str) -> tuple[str, int]:
    """Cria o JWT de acesso. Retorna (token, segundos_até_expirar)."""
    settings = get_settings()
    now = datetime.now(UTC)
    lifetime = timedelta(minutes=settings.access_token_minutes)
    payload = {
        "sub": str(user_id),
        "cid": str(company_id),
        # Só informativo (para o frontend). O backend SEMPRE lê o papel do banco.
        "role": role,
        "typ": "access",
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": now + lifetime,
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM)
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str) -> dict:
    """Valida assinatura, expiração, emissor e público.

    Lança jwt.InvalidTokenError em qualquer problema. `algorithms` fixo impede
    o ataque clássico de trocar o algoritmo do token para "none".
    """
    payload = jwt.decode(
        token,
        get_settings().jwt_secret.get_secret_value(),
        algorithms=[JWT_ALGORITHM],
        audience=JWT_AUDIENCE,
        issuer=JWT_ISSUER,
        options={"require": ["exp", "iat", "sub", "iss", "aud"]},
    )
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("Tipo de token inválido")
    return payload


# --------------------------------------------------------- refresh token


def new_refresh_token() -> tuple[str, str]:
    """Retorna (token_bruto, hash). Só o hash vai para o banco: se o banco
    vazar, os tokens não podem ser usados."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
