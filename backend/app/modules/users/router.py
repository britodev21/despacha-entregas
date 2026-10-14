import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Permission, Role
from app.modules.auth.dependencies import require_permission
from app.modules.users import service
from app.modules.users.models import User
from app.modules.users.schemas import PasswordResetIn, UserCreate, UserOut, UserPage, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

DB = Annotated[Session, Depends(get_db)]
Admin = Annotated[User, Depends(require_permission(Permission.USERS_MANAGE))]


@router.get("", response_model=UserPage)
def list_users(
    admin: Admin,
    db: DB,
    role: Role | None = None,
    is_active: bool | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> UserPage:
    users, total = service.list_users(
        db,
        admin.company_id,
        role=role,
        is_active=is_active,
        search=search,
        limit=limit,
        offset=offset,
    )
    return UserPage(
        items=[UserOut.model_validate(u) for u in users], total=total, limit=limit, offset=offset
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, admin: Admin, db: DB) -> User:
    return service.create_user(db, admin, body)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: uuid.UUID, admin: Admin, db: DB) -> User:
    return service.get_user(db, admin.company_id, user_id)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, body: UserUpdate, admin: Admin, db: DB) -> User:
    return service.update_user(db, admin, user_id, body)


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(user_id: uuid.UUID, body: PasswordResetIn, admin: Admin, db: DB) -> None:
    service.reset_password(db, admin, user_id, body.new_password)


@router.post("/{user_id}/revoke-sessions", status_code=status.HTTP_204_NO_CONTENT)
def revoke_sessions(user_id: uuid.UUID, admin: Admin, db: DB) -> None:
    service.revoke_sessions(db, admin, user_id)
