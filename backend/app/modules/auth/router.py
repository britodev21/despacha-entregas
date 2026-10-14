from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import error_response
from app.core.rate_limit import limit_login, limit_refresh
from app.modules.auth import service
from app.modules.auth.dependencies import CurrentUser, verify_origin
from app.modules.auth.schemas import ChangePasswordIn, LoginIn, MeOut, TokenOut

router = APIRouter(prefix="/auth", tags=["auth"])

DB = Annotated[Session, Depends(get_db)]

REFRESH_COOKIE = "despacha_refresh"
# O cookie só é enviado para as rotas de /auth: nas demais requisições ele
# nem trafega, reduzindo exposição.
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        raw,
        max_age=get_settings().refresh_token_days * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
        httponly=True,  # JavaScript não lê: XSS não consegue roubar
        secure=True,  # só trafega em HTTPS (localhost é exceção nos navegadores)
        samesite="strict",  # não é enviado em requisições vindas de outros sites
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, httponly=True, secure=True, samesite="strict"
    )


@router.post(
    "/login",
    response_model=TokenOut,
    dependencies=[Depends(limit_login), Depends(verify_origin)],
)
def login(body: LoginIn, response: Response, db: DB) -> TokenOut:
    user = service.authenticate(db, body.identifier, body.password)
    tokens = service.start_session(db, user)
    _set_refresh_cookie(response, tokens.refresh_token)
    return TokenOut(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
        user=MeOut.from_user(user),
    )


@router.post(
    "/refresh",
    response_model=TokenOut,
    dependencies=[Depends(limit_refresh), Depends(verify_origin)],
)
def refresh(request: Request, response: Response, db: DB) -> TokenOut | JSONResponse:
    raw = request.cookies.get(REFRESH_COOKIE)
    try:
        if not raw:
            raise service.InvalidSessionError()
        user, tokens = service.rotate_session(db, raw)
    except service.InvalidSessionError as exc:
        # Resposta montada aqui (e não pelo handler global) para também
        # apagar o cookie inválido do navegador.
        error = error_response(exc.status_code, exc.code, exc.message, headers=exc.headers)
        _clear_refresh_cookie(error)
        return error
    _set_refresh_cookie(response, tokens.refresh_token)
    return TokenOut(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
        user=MeOut.from_user(user),
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_origin)],
)
def logout(request: Request, db: DB) -> Response:
    service.end_session(db, request.cookies.get(REFRESH_COOKIE))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


@router.post(
    "/logout-all",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_origin)],
)
def logout_all(user: CurrentUser, db: DB) -> Response:
    service.end_all_sessions(db, user)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser) -> MeOut:
    return MeOut.from_user(user)


@router.post(
    "/change-password",
    response_model=TokenOut,
    dependencies=[Depends(verify_origin)],
)
def change_password(
    body: ChangePasswordIn, request: Request, user: CurrentUser, db: DB
) -> TokenOut:
    tokens = service.change_password(
        db,
        user,
        current_password=body.current_password,
        new_password=body.new_password,
        raw_refresh=request.cookies.get(REFRESH_COOKIE),
    )
    return TokenOut(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
        user=MeOut.from_user(user),
    )
