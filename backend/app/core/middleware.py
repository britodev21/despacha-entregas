"""Middleware de contexto da requisição.

Middleware ASGI "puro" (sem BaseHTTPMiddleware): mais leve e sem os problemas
conhecidos do BaseHTTPMiddleware com streaming e contextvars.

Responsabilidades:
1. Gerar um request_id (devolvido no header X-Request-ID) e registrar IP e
   navegador do cliente no contexto da requisição.
2. Adicionar headers de segurança em toda resposta da API.
3. Capturar exceções inesperadas: loga o stack trace no servidor e devolve
   ao cliente apenas uma mensagem genérica com o request_id.
"""

import logging
import uuid

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.context import client_ip_var, request_id_var, user_agent_var
from app.core.errors import error_response

logger = logging.getLogger("app.request")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    # Respostas da API podem conter dados pessoais: nunca cachear.
    "Cache-Control": "no-store",
    # A API só devolve JSON; nada deve ser executado ou embutido a partir dela.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}

# A documentação interativa (Swagger) carrega scripts e CSS: não aplicamos a CSP
# restritiva nela. Em produção ela fica desligada.
_DOCS_PATHS = ("/api/docs", "/api/openapi.json")


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex
        # scope["client"] já reflete o IP real quando o Uvicorn roda atrás do
        # Nginx com --proxy-headers (e só confia no proxy local).
        client = scope.get("client")
        user_agent = Headers(scope=scope).get("user-agent", "")[:255] or None
        tokens = (
            request_id_var.set(request_id),
            client_ip_var.set(client[0] if client else None),
            user_agent_var.set(user_agent),
        )
        is_docs = scope["path"].startswith(_DOCS_PATHS)
        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
                for name, value in SECURITY_HEADERS.items():
                    if is_docs and name == "Content-Security-Policy":
                        continue
                    headers.setdefault(name, value)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            logger.exception("Erro não tratado em %s %s", scope["method"], scope["path"])
            if response_started:
                raise
            response = error_response(
                500, "INTERNAL_ERROR", "Erro interno. Tente novamente em instantes."
            )
            await response(scope, receive, send_wrapper)
        finally:
            for var, token in zip(
                (request_id_var, client_ip_var, user_agent_var), tokens, strict=True
            ):
                var.reset(token)
