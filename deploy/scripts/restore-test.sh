#!/usr/bin/env bash
# DESPACHA — teste automático de restauração (mensal, via systemd timer).
#
# "Backup sem teste de restauração não é backup." Este script:
#   1. pega o backup mais recente e o decifra com a chave do servidor;
#   2. restaura o banco num contêiner PostgreSQL TEMPORÁRIO e sem rede
#      (nunca toca a produção);
#   3. confere: versão das migrations, tabelas principais com dados e
#      quantidade de entregas e de arquivos coerente com a produção;
#   4. apaga o contêiner temporário e registra o resultado.
# Saída diferente de zero = falha (aparece no `systemctl status` e no journal).

set -Eeuo pipefail
umask 077

# shellcheck source=/dev/null
source /etc/despacha/backup.env

: "${BACKUP_DIR:?defina BACKUP_DIR}"
APP_DIR="${APP_DIR:-/docker/despacha}"
IDENTITY="${IDENTITY:-/etc/despacha/backup-server.agekey}"
TEST_CONTAINER="despacha-restore-test"

compose() { docker compose --project-directory "$APP_DIR" "$@"; }
log() { echo "[restore-test] $*"; }
fail() { echo "[restore-test] FALHA: $*" >&2; exit 1; }
prod_sql() { compose exec -T db psql -U postgres -d despacha -tAX -c "$1"; }
test_sql() { docker exec "$TEST_CONTAINER" psql -U postgres -d despacha -tAX -c "$1"; }

work="$(mktemp -d)"
cleanup() {
    docker rm -f "$TEST_CONTAINER" > /dev/null 2>&1 || true
    rm -rf "$work"
}
trap cleanup EXIT

latest="$(find "$BACKUP_DIR" -maxdepth 1 -name 'despacha-*.tar.age' -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
[[ -n "$latest" ]] || fail "nenhum backup encontrado em ${BACKUP_DIR}"
log "testando ${latest}"

# Um backup com mais de 2 dias indica que o backup diário parou.
[[ -z "$(find "$latest" -mtime +2)" ]] || fail "o backup mais recente tem mais de 2 dias — o backup diário está rodando?"

(cd "$(dirname "$latest")" && sha256sum --check --quiet "$(basename "$latest").sha256")
age --decrypt -i "$IDENTITY" "$latest" | tar -C "$work" -xf -

log "subindo PostgreSQL temporário (sem rede)"
docker rm -f "$TEST_CONTAINER" > /dev/null 2>&1 || true
docker run -d --name "$TEST_CONTAINER" --network none \
    -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" postgres:18-alpine > /dev/null
for _ in $(seq 1 30); do
    docker exec "$TEST_CONTAINER" pg_isready -h 127.0.0.1 -U postgres > /dev/null 2>&1 && break
    sleep 2
done
docker exec "$TEST_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q \
    -c "CREATE ROLE despacha_owner" -c "CREATE ROLE despacha_app" \
    -c "CREATE DATABASE despacha OWNER despacha_owner"

log "restaurando o dump"
docker exec -i "$TEST_CONTAINER" pg_restore -U postgres --exit-on-error -d despacha < "$work/db.dump"

prod_version="$(prod_sql "SELECT version_num FROM alembic_version")"
test_version="$(test_sql "SELECT version_num FROM alembic_version")"
[[ -n "$test_version" ]] || fail "backup sem versão de migration"
if [[ "$test_version" != "$prod_version" ]]; then
    log "aviso: migration do backup (${test_version}) difere da produção (${prod_version}) — normal se houve deploy depois do backup"
fi

for table in companies users; do
    count="$(test_sql "SELECT count(*) FROM ${table}")"
    [[ "$count" -gt 0 ]] || fail "tabela ${table} vazia no backup"
done

prod_deliveries="$(prod_sql "SELECT count(*) FROM deliveries")"
test_deliveries="$(test_sql "SELECT count(*) FROM deliveries")"
if [[ "$prod_deliveries" -gt 0 && "$test_deliveries" -eq 0 ]]; then
    fail "a produção tem entregas e o backup não tem nenhuma"
fi

prod_files="$(compose exec -T api find /data/uploads -type f | wc -l)"
test_files="$(tar -tf "$work/uploads.tar" | grep -vc '/$' || true)"
if [[ "$prod_files" -gt 0 && "$test_files" -eq 0 ]]; then
    fail "a produção tem arquivos de comprovante e o backup não tem nenhum"
fi

log "OK: migration ${test_version}; entregas ${test_deliveries} (produção ${prod_deliveries}); arquivos ${test_files} (produção ${prod_files})"

if [[ -n "${RESTORE_TEST_HEALTHCHECK_URL:-}" ]]; then
    curl -fsS -m 10 --retry 3 "$RESTORE_TEST_HEALTHCHECK_URL" > /dev/null || log "aviso: ping de monitoramento falhou"
fi
