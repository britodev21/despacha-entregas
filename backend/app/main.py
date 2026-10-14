from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.clients.router import router as clients_router
from app.modules.companies.router import router as company_router
from app.modules.deliveries.router import deliverers_router, files_router, me_router
from app.modules.deliveries.router import router as deliveries_router
from app.modules.health.router import router as health_router
from app.modules.reports.router import router as reports_router
from app.modules.tracking.router import me_router as tracking_me_router
from app.modules.tracking.router import router as tracking_router
from app.modules.users.router import router as users_router


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    # Documentação interativa só fora de produção: em produção ela entrega
    # o mapa completo da API para qualquer visitante.
    docs_enabled = not settings.is_production
    app = FastAPI(
        title="DESPACHA API",
        version="0.1.0",
        docs_url="/api/docs" if docs_enabled else None,
        openapi_url="/api/openapi.json" if docs_enabled else None,
        redoc_url=None,
    )

    register_exception_handlers(app)

    # Ordem: o último middleware adicionado é o mais externo.
    # CORS só é ativado se houver origens configuradas (em dev e produção o
    # frontend fica na mesma origem, então normalmente não é necessário).
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )
    app.add_middleware(RequestContextMiddleware)

    api = APIRouter(prefix="/api/v1")
    api.include_router(health_router)
    api.include_router(auth_router)
    api.include_router(users_router)
    api.include_router(clients_router)
    api.include_router(deliveries_router)
    api.include_router(deliverers_router)
    api.include_router(me_router)
    api.include_router(tracking_router)
    api.include_router(tracking_me_router)
    api.include_router(files_router)
    api.include_router(company_router)
    api.include_router(reports_router)
    api.include_router(audit_router)
    app.include_router(api)

    return app


app = create_app()
