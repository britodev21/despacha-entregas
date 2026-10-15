#!/bin/sh
# DESPACHA — roda UMA vez, quando o volume do banco é criado (entrypoint do
# PostgreSQL). Cria os usuários despacha_owner (migrations) e despacha_app
# (API, só DML) e o banco, com as mesmas regras do backend/scripts/setup_db.sql.
#
# As senhas entram pela entrada padrão do psql, nunca como argumento. Use só
# letras e números (ex.: openssl rand -hex 24).

set -eu

: "${DESPACHA_OWNER_PASSWORD:?defina DESPACHA_OWNER_PASSWORD}"
: "${DESPACHA_APP_PASSWORD:?defina DESPACHA_APP_PASSWORD}"

{
    printf '%s\n' "\\set owner_password '${DESPACHA_OWNER_PASSWORD}'"
    printf '%s\n' "\\set app_password '${DESPACHA_APP_PASSWORD}'"
    printf '%s\n' "\\set db_name despacha"
    cat /despacha/setup_db.sql
} | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres
