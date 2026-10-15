#!/usr/bin/env bash
# DESPACHA — restaura um backup num banco e numa pasta de uploads INFORMADOS.
#
#   despacha-restore <arquivo.tar.age> <banco_destino> <pasta_uploads_destino> [identidade_age]
#
# identidade_age: chave privada que decifra o backup. Padrão: a chave do
# servidor. Em caso de desastre (servidor perdido), use a chave do dono.
#
# Por segurança, o script recusa restaurar por cima de um banco existente:
# restaure num banco novo, confira e só então troque (deploy/README.md,
# "Restauração em caso de desastre").

set -Eeuo pipefail
umask 077

backup_file="${1:?uso: despacha-restore <arquivo.tar.age> <banco_destino> <pasta_uploads_destino> [identidade_age]}"
target_db="${2:?informe o banco de destino}"
target_uploads="${3:?informe a pasta de uploads de destino}"
identity="${4:-/etc/despacha/backup-server.agekey}"

log() { echo "[restore] $*"; }
die() { echo "[restore] ERRO: $*" >&2; exit 1; }

# O nome entra em comandos SQL: só letras minúsculas, números e "_".
[[ "$target_db" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "nome de banco inválido: ${target_db}"
[[ -r "$identity" ]] || die "chave de identidade não encontrada: ${identity}"

if [[ -f "${backup_file}.sha256" ]]; then
    log "conferindo integridade (sha256)"
    (cd "$(dirname "$backup_file")" && sha256sum --check --quiet "$(basename "$backup_file").sha256")
fi

if [[ "$(runuser -u postgres -- psql -tAX -c "SELECT 1 FROM pg_database WHERE datname = '${target_db}'")" == "1" ]]; then
    die "o banco ${target_db} já existe. Restaure num banco novo."
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

log "decifrando e extraindo"
age --decrypt -i "$identity" "$backup_file" | tar -C "$work" -xf -

log "criando banco ${target_db} (dono: despacha_owner)"
runuser -u postgres -- createdb --owner=despacha_owner --encoding=UTF8 "$target_db"

log "restaurando o dump"
runuser -u postgres -- pg_restore --exit-on-error --dbname="$target_db" < "$work/db.dump"

# Mesmas permissões do backend/scripts/setup_db.sql. O dump já traz as
# permissões das tabelas; as do banco em si não vão no pg_dump.
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$target_db" << SQL
REVOKE ALL ON DATABASE "${target_db}" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE "${target_db}" TO despacha_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO despacha_app;
SQL

log "restaurando uploads em ${target_uploads}"
mkdir -p "$target_uploads"
tar -C "$target_uploads" -xf "$work/uploads.tar"

log "ok: banco ${target_db} e uploads em ${target_uploads}"
