#!/usr/bin/env bash
# DESPACHA — atualização da aplicação no servidor (rodar como root).
#
#   /docker/despacha/deploy/scripts/deploy.sh
#
# Passos: backup → código → build das imagens → migrations (contêiner
# `migrate`) → troca dos contêineres → verificação de saúde.
# Se as migrations falharem, a API antiga continua no ar (o compose só troca a
# API depois que `migrate` termina com sucesso).

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/docker/despacha}"
compose() { docker compose --project-directory "$APP_DIR" "$@"; }
log() { echo "[deploy] $*"; }

cd "$APP_DIR"
previous_commit="$(git rev-parse --short HEAD)"

log "1/5 backup antes de mudar qualquer coisa"
if systemctl cat despacha-backup.service > /dev/null 2>&1; then
    systemctl start despacha-backup.service
else
    log "AVISO: backup ainda não configurado (deploy/README.md, 'Backup cifrado')"
fi

log "2/5 atualizando o código (de ${previous_commit})"
git pull --ff-only
current_commit="$(git rev-parse --short HEAD)"

log "3/5 build das imagens"
compose build --pull

log "4/5 migrations e troca dos contêineres"
compose up -d --remove-orphans

log "5/5 verificação de saúde"
for _ in $(seq 1 30); do
    if compose exec -T web wget -q -O - http://127.0.0.1:8080/api/v1/health 2> /dev/null | grep -q '"status":"ok"'; then
        log "deploy concluído: ${previous_commit} → ${current_commit}"
        docker image prune -f > /dev/null
        exit 0
    fi
    sleep 2
done

log "ERRO: a aplicação não respondeu saudável"
log "veja: docker compose logs --tail 100 migrate api web"
log "voltar: git checkout ${previous_commit} && docker compose up -d --build"
exit 1
