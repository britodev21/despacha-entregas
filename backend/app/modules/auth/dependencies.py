"""Dependências de autenticação e autorização para as rotas.

    @router.get("/algo")
    def rota(user: Annotated[User, Depends(require_permission(Permission.X))]): ...

Toda rota protegida passa por aqui. O frontend esconder um botão é UX;
quem decide o acesso é SEMPRE o backend.
"""

import uuid
from collections.abc import Callable
from typing import Annotated
from urllib.parse import urlsplit

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.permissions import Permission, has_permission
from app.core.security import decode_access_token
from app.modules.users.models import User

_bearer = HTTPBearer(auto_error=False)


class TokenInvalidError(UnauthorizedError):
    code = "TOKEN_INVALID"
    message = "Sessão expirada ou inválida."


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise UnauthorizedError()
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except jwt.InvalidTokenError, ValueError:
        raise TokenInvalidError() from None

    # O token só diz QUEM é. Papel, status e empresa vêm do banco, agora:
    # desativar alguém ou trocar seu papel vale imediatamente.
    user = db.get(User, user_id)
    if user is None or not user.is_active or not user.company.is_active:
        raise TokenInvalidError()
    # Token emitido antes da última troca de senha não vale mais.
    if payload["iat"] < int(user.password_changed_at.timestamp()):
        raise TokenInvalidError()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_permission(permission: Permission) -> Callable[..., User]:
    def dependency(user: CurrentUser) -> User:
        if not has_permission(user.role, permission):
            raise ForbiddenError()
        return user

    return dependency


def verify_origin(request: Request) -> None:
    """Defesa extra contra CSRF nas rotas que usam o cookie de refresh.

    Navegadores sempre enviam o header Origin em POST. Se ele existir e não
    for a nossa própria origem (nem uma origem configurada), recusamos.
    Somado ao cookie SameSite=Strict, um site de terceiros não consegue usar
    a sessão do usuário.
    """
    origin = request.headers.get("origin")
    if origin is None:
        return
    if urlsplit(origin).netloc == request.headers.get("host"):
        return
    if origin in get_settings().cors_origins:
        return
    raise ForbiddenError("Origem da requisição não permitida.", code="ORIGIN_NOT_ALLOWED")
