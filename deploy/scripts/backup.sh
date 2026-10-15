#!/usr/bin/env bash
# DESPACHA — backup diário: banco (pg_dump) + fotos/assinaturas (uploads).
#
# Resultado: um único arquivo cifrado com `age` para DUAS chaves públicas:
#   - a chave do DONO (a privada fica fora do servidor): recupera tudo se o
#     servidor for perdido;
#   - a chave do SERVIDOR (privada em /etc/despacha, só root): permite o teste
#     automático de restauração (restore-test.sh).
# A cópia externa (rclone, opcional) fica ilegível para o provedor.
#
# Configuração: /etc/despacha/backup.env (modelo em deploy/env/backup.env.example).

set -Eeuo pipefail
umask 077

# shellcheck source=/dev/null
source /etc/despacha/backup.env

: "${BACKUP_DIR:?defina BACKUP_DIR}"
: "${AGE_RECIPIENTS_FILE:?defina AGE_RECIPIENTS_FILE}"
APP_DIR="${APP_DIR:-/docker/despacha}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

compose() { docker compose --project-directory "$APP_DIR" "$@"; }
log() { echo "[backup] $*"; }

timestamp="$(date +%Y%m%d-%H%M%S)"
target="${BACKUP_DIR}/despacha-${timestamp}.tar.age"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$BACKUP_DIR"

log "dump do banco"
# Formato custom (-Fc): comprimido e restaurável seletivamente com pg_restore.
compose exec -T db pg_dump -U postgres --format=custom despacha > "$work/db.dump"

log "arquivando uploads"
compose exec -T api tar -C /data/uploads -cf - . > "$work/uploads.tar"

log "cifrando em ${target}"
tar -C "$work" -cf - db.dump uploads.tar | age --encrypt -R "$AGE_RECIPIENTS_FILE" > "$target.partial"
mv "$target.partial" "$target"  # só aparece completo (nada de backup pela metade)
sha256sum "$target" > "$target.sha256"

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
    log "copiando para fora do servidor"
    rclone copy "$target" "$RCLONE_REMOTE"
    rclone copy "$target.sha256" "$RCLONE_REMOTE"
else
    log "AVISO: RCLONE_REMOTE vazio — backup só local não protege contra perda do servidor"
fi

log "removendo backups locais com mais de ${RETENTION_DAYS} dias"
find "$BACKUP_DIR" -name 'despacha-*.tar.age*' -mtime +"$RETENTION_DAYS" -delete

# Monitoramento: avisa um serviço externo que o backup rodou (sem ping = alerta).
if [[ -n "${HEALTHCHECK_URL:-}" ]]; then
    curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL" > /dev/null || log "AVISO: ping de monitoramento falhou"
fi

log "ok: $(du -h "$target" | cut -f1)"
