"""Gestão de usuários da empresa (somente ADMIN).

Regra de ouro (ADR-01): TODA consulta é filtrada pelo company_id de quem
está pedindo. Usuário de outra empresa "não existe" (404, não 403).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.core.permissions import Role
from app.core.security import hash_password
from app.modules.audit import service as audit
from app.modules.audit.models import AuditAction
from app.modules.auth.service import revoke_user_sessions
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate, UserUpdate

RESOURCE = "user"


def list_users(
    db: Session,
    company_id: uuid.UUID,
    *,
    role: Role | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[User], int]:
    stmt = select(User).where(User.company_id == company_id)
    if role is not None:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    if search:
        # autoescape: "%" e "_" digitados viram texto literal, não curingas do LIKE.
        stmt = stmt.where(
            or_(
                User.name.icontains(search, autoescape=True),
                User.email.icontains(search, autoescape=True),
                User.phone.icontains(search, autoescape=True),
            )
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    users = db.scalars(stmt.order_by(User.name).limit(limit).offset(offset)).all()
    return list(users), total


def get_user(db: Session, company_id: uuid.UUID, user_id: uuid.UUID) -> User:
    user = db.scalar(select(User).where(User.id == user_id, User.company_id == company_id))
    if user is None:
        raise NotFoundError("Usuário não encontrado.")
    return user


def create_user(db: Session, actor: User, data: UserCreate) -> User:
    _ensure_unique(db, email=data.email, phone=data.phone)
    user = User(
        company_id=actor.company_id,  # SEMPRE da empresa de quem cria
        name=data.name,
        email=data.email,
        phone=data.phone,
        role=data.role,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.flush()  # gera o id para a auditoria
    audit.record(
        db,
        AuditAction.USER_CREATED,
        company_id=actor.company_id,
        user_id=actor.id,
        resource_type=RESOURCE,
        resource_id=user.id,
        details={"role": data.role},
    )
    _commit_unique(db)
    return user


def update_user(db: Session, actor: User, user_id: uuid.UUID, data: UserUpdate) -> User:
    user = get_user(db, actor.company_id, user_id)
    changes = data.model_dump(exclude_unset=True)

    if user.id == actor.id and ("role" in changes or changes.get("is_active") is False):
        # Impede o admin de se trancar para fora. Como só admins gerenciam
        # usuários, isso também garante que sempre reste um admin ativo.
        raise ConflictError(
            "Você não pode alterar o próprio papel nem desativar a própria conta.",
            code="SELF_LOCKOUT",
        )

    email = changes.get("email", user.email)
    phone = changes.get("phone", user.phone)
    if not email and not phone:
        raise ConflictError("O usuário precisa ter e-mail ou telefone.", code="EMAIL_OR_PHONE")
    _ensure_unique(
        db,
        email=email if "email" in changes else None,
        phone=phone if "phone" in changes else None,
        exclude_id=user.id,
    )

    old_role, old_active = user.role, user.is_active
    for field, value in changes.items():
        setattr(user, field, value)

    def log(action: AuditAction, details: dict | None = None) -> None:
        audit.record(
            db,
            action,
            company_id=actor.company_id,
            user_id=actor.id,
            resource_type=RESOURCE,
            resource_id=user.id,
            details=details,
        )

    if "role" in changes and changes["role"] != old_role:
        log(AuditAction.USER_ROLE_CHANGED, {"from": old_role, "to": changes["role"]})
    if "is_active" in changes and changes["is_active"] != old_active:
        if changes["is_active"]:
            log(AuditAction.USER_ACTIVATED)
        else:
            # Desativado: derruba todas as sessões na hora.
            revoke_user_sessions(db, user.id)
            log(AuditAction.USER_DEACTIVATED)
    other_fields = sorted(set(changes) - {"role", "is_active"})
    if other_fields:
        # Registra QUAIS campos mudaram, não os valores (dados pessoais).
        log(AuditAction.USER_UPDATED, {"fields": other_fields})

    _commit_unique(db)
    return user


def reset_password(db: Session, actor: User, user_id: uuid.UUID, new_password: str) -> None:
    user = get_user(db, actor.company_id, user_id)
    user.password_hash = hash_password(new_password)
    user.password_changed_at = datetime.now(UTC)
    # Senha nova também desbloqueia a conta.
    user.failed_login_count = 0
    user.locked_until = None
    revoke_user_sessions(db, user.id)
    audit.record(
        db,
        AuditAction.USER_PASSWORD_RESET,
        company_id=actor.company_id,
        user_id=actor.id,
        resource_type=RESOURCE,
        resource_id=user.id,
    )
    db.commit()


def revoke_sessions(db: Session, actor: User, user_id: uuid.UUID) -> None:
    """Admin encerra todas as sessões de alguém (ex.: celular perdido)."""
    user = get_user(db, actor.company_id, user_id)
    revoke_user_sessions(db, user.id)
    user.sessions_revoked_at = datetime.now(UTC)
    audit.record(
        db,
        AuditAction.USER_SESSIONS_REVOKED,
        company_id=actor.company_id,
        user_id=actor.id,
        resource_type=RESOURCE,
        resource_id=user.id,
    )
    db.commit()


def _ensure_unique(
    db: Session,
    *,
    email: str | None,
    phone: str | None,
    exclude_id: uuid.UUID | None = None,
) -> None:
    def taken(column, value) -> bool:
        stmt = select(User.id).where(column == value)
        if exclude_id is not None:
            stmt = stmt.where(User.id != exclude_id)
        return db.scalar(stmt) is not None

    if email and taken(User.email, email):
        raise ConflictError("Este e-mail já está em uso.", code="EMAIL_TAKEN")
    if phone and taken(User.phone, phone):
        raise ConflictError("Este telefone já está em uso.", code="PHONE_TAKEN")


def _commit_unique(db: Session) -> None:
    # A checagem acima não cobre duas requisições simultâneas com o mesmo
    # e-mail; a constraint UNIQUE do banco cobre. Traduzimos o erro.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError("E-mail ou telefone já está em uso.", code="CONTACT_TAKEN") from None
