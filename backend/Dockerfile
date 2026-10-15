# DESPACHA — imagem da API (FastAPI/Uvicorn). Também roda as migrations
# (serviço `migrate` do docker-compose.yml) e os comandos da CLI.

FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv

WORKDIR /app

# Dependências primeiro (camada reaproveitada enquanto o uv.lock não muda).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

# Usuário sem privilégios; a pasta de uploads é o único lugar gravável
# (o docker-compose.yml monta um volume nela e deixa o resto somente leitura).
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin despacha \
    && mkdir -p /data/uploads \
    && chown despacha:despacha /data/uploads

USER despacha
ENV UPLOAD_DIR=/data/uploads
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4)"]

# - Workers: variável WEB_CONCURRENCY (padrão do Uvicorn), definida no compose.
# - --proxy-headers: o IP real vem do Nginx do serviço `web`, que fica na
#   mesma rede fechada; a API não tem porta publicada, então ninguém de fora
#   fala direto com ela (daí confiar em qualquer origem dentro da rede).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*", \
     "--no-server-header", "--no-access-log"]
