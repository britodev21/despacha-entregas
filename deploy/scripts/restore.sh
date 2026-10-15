#!/usr/bin/env bash
# DESPACHA — restaura um backup no banco e nos uploads do docker compose.
#
#   restore.sh <arquivo.tar.age> [identidade_age]
#
# identidade_age: chave privada que decifra o backup. Padrão: a do servidor.
# Em caso de desastre (servidor perdido), use a chave do dono.
#
# Segurança: a API precisa estar PARADA, e o banco `despacha` precisa estar
# vazio (instalação nova). O script se recusa a sobrescrever dados existentes:
# veja deploy/README.md, "Restauração em caso de desastre".

set -Eeuo pipefail
umask 077

backup_file="${1:?uso: restore.sh <arquivo.tar.age> [identidade_age]}"
identity="${2:-/etc/despacha/backup-server.agekey}"
APP_DIR="${APP_DIR:-/docker/despacha}"

compose() { docker compose --project-directory "$APP_DIR" "$@"; }
log() { echo "[restore] $*"; }
die() { echo "[restore] ERRO: $*" >&2; exit 1; }
sql() { compose exec -T db psql -U postgres -d despacha -tAX -c "$1"; }

[[ -r "$identity" ]] || die "chave de identidade não encontrada: ${identity}"
if [[ -n "$(compose ps --status running --quiet api)" ]]; then
    die "a API está rodando. Pare antes: docker compose stop web api"
fi
[[ "$(sql "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")" == "0" ]] \
    || die "o banco despacha já tem tabelas. Restaure só numa instalação nova."

if [[ -f "${backup_file}.sha256" ]]; then
    log "conferindo integridade (sha256)"
    (cd "$(dirname "$backup_file")" && sha256sum --check --quiet "$(basename "$backup_file").sha256")
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

log "decifrando e extraindo"
age --decrypt -i "$identity" "$backup_file" | tar -C "$work" -xf -

log "restaurando o banco"
compose exec -T db pg_restore -U postgres --exit-on-error -d despacha < "$work/db.dump"

log "restaurando os uploads"
compose run --rm --no-deps -T --entrypoint tar api -C /data/uploads -xf - < "$work/uploads.tar"

log "ok. Suba a aplicação: docker compose up -d"
