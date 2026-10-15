#!/usr/bin/env bash
# DESPACHA — teste automático de restauração (mensal, via systemd timer).
#
# "Backup sem teste de restauração não é backup." Este script:
#   1. pega o backup mais recente;
#   2. restaura num banco e numa pasta TEMPORÁRIOS (nunca toca a produção);
#   3. confere: versão das migrations, tabelas principais com dados, contagem
#      de entregas e de arquivos coerente com a produção;
#   4. apaga os temporários e registra o resultado.
# Saída diferente de zero = falha (aparece no `systemctl status` e no journal).

set -Eeuo pipefail

# shellcheck source=/dev/null
source /etc/despacha/backup.env

: "${DB_NAME:?defina DB_NAME}"
: "${UPLOAD_DIR:?defina UPLOAD_DIR}"
: "${BACKUP_DIR:?defina BACKUP_DIR}"
RESTORE_BIN="${RESTORE_BIN:-/usr/local/sbin/despacha-restore}"
TEST_DB="despacha_restore_test"
work="$(mktemp -d)"

cleanup() {
    runuser -u postgres -- dropdb --if-exists "$TEST_DB" || true
    rm -rf "$work"
}
trap cleanup EXIT

log() { echo "[restore-test] $*"; }
fail() { echo "[restore-test] FALHA: $*" >&2; exit 1; }
sql() { runuser -u postgres -- psql -tAX -d "$1" -c "$2"; }

latest="$(find "$BACKUP_DIR" -maxdepth 1 -name 'despacha-*.tar.age' -printf '%T@ %p\n' | sort -rn | head -n 1 | cut -d' ' -f2-)"
[[ -n "$latest" ]] || fail "nenhum backup encontrado em ${BACKUP_DIR}"
log "testando ${latest}"

# Um backup com mais de 2 dias indica que o backup diário parou.
if [[ -n "$(find "$latest" -mtime +2)" ]]; then
    fail "o backup mais recente tem mais de 2 dias — o backup diário está rodando?"
fi

runuser -u postgres -- dropdb --if-exists "$TEST_DB"
"$RESTORE_BIN" "$latest" "$TEST_DB" "$work/uploads"

prod_version="$(sql "$DB_NAME" "SELECT version_num FROM alembic_version")"
test_version="$(sql "$TEST_DB" "SELECT version_num FROM alembic_version")"
[[ -n "$test_version" ]] || fail "backup sem versão de migration"
if [[ "$test_version" != "$prod_version" ]]; then
    log "aviso: migration do backup (${test_version}) difere da produção (${prod_version}) — normal se houve deploy depois do backup"
fi

for table in companies users; do
    count="$(sql "$TEST_DB" "SELECT count(*) FROM ${table}")"
    [[ "$count" -gt 0 ]] || fail "tabela ${table} vazia no backup"
done

prod_deliveries="$(sql "$DB_NAME" "SELECT count(*) FROM deliveries")"
test_deliveries="$(sql "$TEST_DB" "SELECT count(*) FROM deliveries")"
if [[ "$prod_deliveries" -gt 0 && "$test_deliveries" -eq 0 ]]; then
    fail "a produção tem entregas e o backup não tem nenhuma"
fi

prod_files="$(find "$UPLOAD_DIR" -type f | wc -l)"
test_files="$(find "$work/uploads" -type f | wc -l)"
if [[ "$prod_files" -gt 0 && "$test_files" -eq 0 ]]; then
    fail "a produção tem arquivos de comprovante e o backup não tem nenhum"
fi

log "OK: migration ${test_version}; entregas ${test_deliveries} (produção ${prod_deliveries}); arquivos ${test_files} (produção ${prod_files})"

if [[ -n "${RESTORE_TEST_HEALTHCHECK_URL:-}" ]]; then
    curl -fsS -m 10 --retry 3 "$RESTORE_TEST_HEALTHCHECK_URL" > /dev/null || log "aviso: ping de monitoramento falhou"
fi
