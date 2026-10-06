"""Erros da aplicação e formato único de resposta de erro.

Toda resposta de erro da API tem o mesmo formato:

    {"error": {"code": "...", "message": "...", "request_id": "...", "details": [...]}}

O frontend trata erros num lugar só, e nunca vazamos stack trace ou detalhes internos.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.context import request_id_var

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Erro de negócio esperado. Services lançam; o handler converte em JSON."""

    status_code = 400
    code = "BAD_REQUEST"
    message = "Requisição inválida."
    headers: dict[str, str] | None = None

    def __init__(self, message: str | None = None, *, code: str | None = None):
        self.message = message or self.message
        self.code = code or self.code
        super().__init__(self.message)


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"
    message = "Autenticação necessária."
    headers = {"WWW-Authenticate": "Bearer"}


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"
    message = "Recurso não encontrado."


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"
    message = "Conflito com o estado atual do recurso."


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"
    message = "Você não tem permissão para esta ação."


class TooManyRequestsError(AppError):
    status_code = 429
    code = "TOO_MANY_REQUESTS"
    message = "Muitas tentativas. Aguarde um pouco e tente novamente."

    def __init__(self, retry_after: int):
        super().__init__()
        self.headers = {"Retry-After": str(retry_after)}


_HTTP_CODES = {
    401: ("UNAUTHORIZED", "Autenticação necessária."),
    403: ("FORBIDDEN", "Você não tem permissão para esta ação."),
    404: ("NOT_FOUND", "Recurso não encontrado."),
    405: ("METHOD_NOT_ALLOWED", "Método não permitido."),
    429: ("TOO_MANY_REQUESTS", "Muitas tentativas. Aguarde e tente novamente."),
}


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: list | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body: dict = {"code": code, "message": message, "request_id": request_id_var.get()}
    if details:
        body["details"] = details
    return JSONResponse(status_code=status_code, content={"error": body}, headers=headers)


async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return error_response(exc.status_code, exc.code, exc.message, headers=exc.headers)


async def _http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code, message = _HTTP_CODES.get(exc.status_code, ("HTTP_ERROR", "Erro na requisição."))
    return error_response(exc.status_code, code, message)


async def _validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    # O formato padrão do FastAPI devolve o campo "input" com o valor enviado.
    # Isso ecoaria senhas e dados pessoais na resposta (e em logs de proxy).
    # Devolvemos só onde está o erro e o que está errado.
    details = [
        {
            "field": ".".join(str(part) for part in err["loc"] if part != "body"),
            "message": err["msg"],
            "type": err["type"],
        }
        for err in exc.errors()
    ]
    return error_response(422, "VALIDATION_ERROR", "Dados inválidos.", details)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    # Exceções inesperadas (500) são tratadas no RequestContextMiddleware.
