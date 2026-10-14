"""Regras de autenticação: login, sessões (refresh tokens) e troca de senha.

Ver ADR-04 em docs/ARQUITETURA.md.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.context import client_ip_var, user_agent_var
from app.core.errors import AppError, UnauthorizedError
from app.core.security import (
    burn_password_check,
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.core.validators import normalize_phone
from app.modules.audit import service as audit
from app.modules.audit.models import AuditAction
from app.modules.auth.models import RefreshToken
from app.modules.users.models import User

# Bloqueio máximo, mesmo após muitas rodadas de falhas.
_MAX_LOCK = timedelta(hours=24)


class InvalidCredentialsError(UnauthorizedError):
    # Mensagem idêntica para usuário inexistente, senha errada, conta bloqueada
    # ou desativada: não revelamos quais contas existem (user enumeration).
    code = "INVALID_CREDENTIALS"
    message = "E-mail/telefone ou senha incorretos."


class InvalidSessionError(UnauthorizedError):
    code = "SESSION_INVALID"
    message = "Sua sessão expirou. Entre novamente."


@dataclass(frozen=True)
class SessionTokens:
    access_token: str
    expires_in: int
    refresh_token: str | None = None


def _now() -> datetime:
    return datetime.now(UTC)


# ------------------------------------------------------------------ login


def find_user_by_identifier(
    db: Session, identifier: str, *, for_update: bool = False
) -> User | None:
    identifier = identifier.strip()
    if "@" in identifier:
        stmt = select(User).where(User.email == identifier.lower())
    else:
        try:
            stmt = select(User).where(User.phone == normalize_phone(identifier))
        except ValueError:
            return None
    if for_update:
        # Trava a linha: tentativas simultâneas de força bruta não conseguem
        # "furar" o contador de falhas lendo o mesmo valor ao mesmo tempo.
        stmt = stmt.with_for_update(of=User)
    return db.scalar(stmt)


def authenticate(db: Session, identifier: str, password: str) -> User:
    """Valida credenciais. Em qualquer falha: registra auditoria, faz commit
    (o registro precisa persistir mesmo com a exceção) e lança o MESMO erro."""
    settings = get_settings()
    now = _now()
    user = find_user_by_identifier(db, identifier, for_update=True)

    if user is None:
        burn_password_check(password)  # mesmo tempo de resposta de um usuário real
        audit.record(db, AuditAction.AUTH_LOGIN_FAILED, details={"reason": "unknown_identifier"})
        db.commit()
        raise InvalidCredentialsError()

    def fail(action: AuditAction, reason: str, **extra: object) -> InvalidCredentialsError:
        audit.record(
            db,
            action,
            company_id=user.company_id,
            user_id=user.id,
            details={"reason": reason, **extra},
        )
        db.commit()
        return InvalidCredentialsError()

    if user.locked_until and user.locked_until > now:
        # Conta bloqueada: recusa mesmo com senha correta (senão o bloqueio
        # não protegeria nada), gastando o mesmo tempo de uma verificação real.
        burn_password_check(password)
        raise fail(AuditAction.AUTH_LOGIN_BLOCKED, "account_locked")

    valid, upgraded_hash = verify_password(password, user.password_hash)
    if not valid:
        user.failed_login_count += 1
        if user.failed_login_count % settings.login_max_failures == 0:
            # Bloqueio progressivo: 15 min, 30, 60... até 24 h.
            round_ = user.failed_login_count // settings.login_max_failures
            lock = min(
                timedelta(minutes=settings.login_lock_minutes * 2 ** (round_ - 1)), _MAX_LOCK
            )
            user.locked_until = now + lock
            audit.record(
                db,
                AuditAction.AUTH_ACCOUNT_LOCKED,
                company_id=user.company_id,
                user_id=user.id,
                details={"minutes": int(lock.total_seconds() // 60)},
            )
        raise fail(AuditAction.AUTH_LOGIN_FAILED, "wrong_password")

    if not user.is_active or not user.company.is_active:
        raise fail(AuditAction.AUTH_LOGIN_FAILED, "inactive")

    if upgraded_hash:
        user.password_hash = upgraded_hash
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    return user


def start_session(db: Session, user: User) -> SessionTokens:
    """Cria uma nova família de refresh token (um novo "login")."""
    refresh = _issue_refresh_token(db, user, family_id=uuid.uuid7())
    audit.record(db, AuditAction.AUTH_LOGIN_SUCCEEDED, company_id=user.company_id, user_id=user.id)
    db.commit()
    access, expires_in = _access_token_for(user)
    return SessionTokens(access, expires_in, refresh)


# --------------------------------------------------------------- sessões


def rotate_session(db: Session, raw_refresh: str) -> tuple[User, SessionTokens]:
    """Troca um refresh token válido por um novo (rotação)."""
    now = _now()
    token = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(raw_refresh))
        .with_for_update()
    )
    if token is None or token.revoked_at is not None or token.expires_at <= now:
        raise InvalidSessionError()

    user = db.get(User, token.user_id)

    if token.used_at is not None:
        # Token já trocado antes sendo apresentado de novo: foi copiado.
        # Revogamos a família inteira; o ladrão E o dono precisam logar de novo,
        # e só o dono sabe a senha.
        _revoke_family(db, token.family_id, now)
        audit.record(
            db,
            AuditAction.AUTH_REFRESH_REUSE_DETECTED,
            company_id=user.company_id if user else None,
            user_id=token.user_id,
            details={"family_id": str(token.family_id)},
        )
        db.commit()
        raise InvalidSessionError()

    if user is None or not user.is_active or not user.company.is_active:
        _revoke_family(db, token.family_id, now)
        db.commit()
        raise InvalidSessionError()

    token.used_at = now
    refresh = _issue_refresh_token(db, user, family_id=token.family_id)
    db.commit()
    access, expires_in = _access_token_for(user)
    return user, SessionTokens(access, expires_in, refresh)


def end_session(db: Session, raw_refresh: str | None) -> None:
    """Logout: revoga a família do token atual. Idempotente."""
    if not raw_refresh:
        return
    token = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_refresh))
    )
    if token is None:
        return
    _revoke_family(db, token.family_id, _now())
    user = db.get(User, token.user_id)
    audit.record(
        db,
        AuditAction.AUTH_LOGOUT,
        company_id=user.company_id if user else None,
        user_id=token.user_id,
    )
    db.commit()


def revoke_user_sessions(
    db: Session, user_id: uuid.UUID, *, keep_family: uuid.UUID | None = None
) -> None:
    """Revoga todas as sessões do usuário (exceto, opcionalmente, a atual).
    Não faz commit: participa da transação de quem chamou."""
    stmt = update(RefreshToken).where(
        RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
    )
    if keep_family is not None:
        stmt = stmt.where(RefreshToken.family_id != keep_family)
    db.execute(stmt.values(revoked_at=_now()))


def end_all_sessions(db: Session, user: User) -> None:
    """Sair de todos os dispositivos: revoga os refresh tokens E invalida os
    access tokens já emitidos (celular perdido ou roubado)."""
    revoke_user_sessions(db, user.id)
    user.sessions_revoked_at = _now()
    audit.record(db, AuditAction.AUTH_LOGOUT_ALL, company_id=user.company_id, user_id=user.id)
    db.commit()


def purge_expired_sessions(db: Session, older_than_days: int = 7) -> int:
    """Remove refresh tokens vencidos ou revogados há mais de N dias."""
    cutoff = _now() - timedelta(days=older_than_days)
    result = db.execute(
        delete(RefreshToken).where(
            (RefreshToken.expires_at < cutoff) | (RefreshToken.revoked_at < cutoff)
        )
    )
    db.commit()
    return result.rowcount or 0


# ---------------------------------------------------------------- senha


def change_password(
    db: Session, user: User, *, current_password: str, new_password: str, raw_refresh: str | None
) -> SessionTokens:
    valid, _ = verify_password(current_password, user.password_hash)
    if not valid:
        raise AppError("Senha atual incorreta.", code="WRONG_CURRENT_PASSWORD")
    if current_password == new_password:
        raise AppError("A nova senha deve ser diferente da atual.", code="SAME_PASSWORD")

    user.password_hash = hash_password(new_password)
    user.password_changed_at = _now()

    # Derruba as outras sessões (ex.: um celular perdido), mantém a atual.
    keep_family = None
    if raw_refresh:
        current = db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_refresh))
        )
        if current is not None and current.user_id == user.id:
            keep_family = current.family_id
    revoke_user_sessions(db, user.id, keep_family=keep_family)

    audit.record(db, AuditAction.AUTH_PASSWORD_CHANGED, company_id=user.company_id, user_id=user.id)
    db.commit()
    # Access tokens antigos ficam inválidos (emitidos antes de password_changed_at).
    access, expires_in = _access_token_for(user)
    return SessionTokens(access, expires_in)


# ---------------------------------------------------------------- interno


def _issue_refresh_token(db: Session, user: User, *, family_id: uuid.UUID) -> str:
    raw, token_hash = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            family_id=family_id,
            token_hash=token_hash,
            expires_at=_now() + timedelta(days=get_settings().refresh_token_days),
            ip=client_ip_var.get(),
            user_agent=user_agent_var.get(),
        )
    )
    return raw


def _revoke_family(db: Session, family_id: uuid.UUID, now: datetime) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def _access_token_for(user: User) -> tuple[str, int]:
    return create_access_token(user_id=user.id, company_id=user.company_id, role=user.role)
