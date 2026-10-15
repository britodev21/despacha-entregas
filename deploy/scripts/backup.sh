#!/usr/bin/env bash
# DESPACHA — backup diário: banco (pg_dump) + fotos/assinaturas (uploads).
#
# Resultado: um único arquivo cifrado com `age` para DUAS chaves públicas:
#   - a chave do DONO (a privada fica fora do servidor): recupera tudo se o
#     servidor for perdido;
#   - a chave do SERVIDOR (privada em /etc/despacha, só root): permite o teste
#     automático de restauração (restore-test.sh).
# A cópia externa (rclone) fica ilegível para o provedor de armazenamento.
#
# Configuração: /etc/despacha/backup.env (modelo em deploy/env/backup.env.example).
# Instalado como /usr/local/sbin/despacha-backup (ver deploy/README.md).

set -Eeuo pipefail
umask 077

# shellcheck source=/dev/null
source /etc/despacha/backup.env

: "${DB_NAME:?defina DB_NAME}"
: "${UPLOAD_DIR:?defina UPLOAD_DIR}"
: "${BACKUP_DIR:?defina BACKUP_DIR}"
: "${AGE_RECIPIENTS_FILE:?defina AGE_RECIPIENTS_FILE}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

timestamp="$(date +%Y%m%d-%H%M%S)"
target="${BACKUP_DIR}/despacha-${timestamp}.tar.age"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

log() { echo "[backup] $*"; }

mkdir -p "$BACKUP_DIR"

log "dump do banco ${DB_NAME}"
# Formato custom (-Fc): comprimido e restaurável seletivamente com pg_restore.
# O redirecionamento é feito pelo root: o arquivo nasce na pasta temporária 0700.
runuser -u postgres -- pg_dump --format=custom "$DB_NAME" > "$work/db.dump"

log "arquivando uploads de ${UPLOAD_DIR}"
tar -C "$UPLOAD_DIR" -cf "$work/uploads.tar" .

log "cifrando em ${target}"
tar -C "$work" -cf - db.dump uploads.tar | age --encrypt -R "$AGE_RECIPIENTS_FILE" > "$target.partial"
mv "$target.partial" "$target"  # só aparece completo (nada de backup pela metade)
sha256sum "$target" > "$target.sha256"

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
    log "copiando para fora do servidor (${RCLONE_REMOTE})"
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
