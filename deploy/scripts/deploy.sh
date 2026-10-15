#!/usr/bin/env bash
# DESPACHA — atualização da aplicação no servidor (rodar como root).
#
#   despacha-deploy            (instalado em /usr/local/sbin, ver deploy/README.md)
#
# Passos: backup → código → dependências → migrations → build do frontend
# (em pasta nova) → troca atômica → reinício da API → verificação de saúde.
# Se a verificação falhar, o frontend volta para a versão anterior e o script
# para com erro; a API e o banco exigem análise manual (README, "Rollback").
#
# Segurança: o root só COPIA arquivos do checkout; tudo que executa código do
# repositório ou de dependências (git, uv, npm, alembic) roda como `despacha`.

set -Eeuo pipefail

APP_DIR=/opt/despacha/app
WEB_DIR=/var/www/despacha
UV=/usr/local/bin/uv
RELEASES_TO_KEEP=5

as_app() { runuser -u despacha -- "$@"; }
log() { echo "[deploy] $*"; }

[[ $EUID -eq 0 ]] || { echo "rode como root" >&2; exit 1; }

previous_commit="$(as_app git -C "$APP_DIR" rev-parse --short HEAD)"

log "1/7 backup antes de mudar qualquer coisa"
systemctl start despacha-backup.service

log "2/7 atualizando o código (de ${previous_commit})"
as_app git -C "$APP_DIR" pull --ff-only
current_commit="$(as_app git -C "$APP_DIR" rev-parse --short HEAD)"

log "3/7 dependências do backend (versões travadas no uv.lock)"
# --compile-bytecode: a API roda com o disco somente leitura e não grava .pyc.
(cd "$APP_DIR/backend" && as_app "$UV" sync --frozen --no-dev --compile-bytecode)

log "4/7 migrations (usuário dono do schema; credencial só neste passo)"
# systemd-run lê os arquivos de ambiente com o MESMO parser do serviço da API
# (sem `source` no shell) e roda como `despacha`, num processo isolado.
systemd-run --quiet --wait --pipe --collect \
    --uid=despacha --gid=despacha \
    -p WorkingDirectory="$APP_DIR/backend" \
    -p EnvironmentFile=/etc/despacha/backend.env \
    -p EnvironmentFile=/etc/despacha/migrations.env \
    -p NoNewPrivileges=yes -p ProtectSystem=strict -p PrivateTmp=yes \
    "$APP_DIR/backend/.venv/bin/alembic" upgrade head

log "5/7 build do frontend"
(
    cd "$APP_DIR/frontend"
    # O Vite lê .env.production.local no build (arquivo ignorado pelo git).
    as_app cp /etc/despacha/frontend.env .env.production.local
    # --ignore-scripts: nenhum pacote executa código na instalação (nenhuma
    # dependência do projeto precisa disso no Linux).
    as_app npm ci --ignore-scripts --no-audit --no-fund
    as_app npm run build
)
release="$WEB_DIR/releases/$(date +%Y%m%d-%H%M%S)-${current_commit}"
mkdir -p "$release"
cp -a "$APP_DIR/frontend/dist/." "$release/"
chown -R root:root "$release"
previous_release="$(readlink -f "$WEB_DIR/current" || true)"

log "6/7 troca atômica do frontend e reinício da API"
ln -sfn "$release" "$WEB_DIR/current.new"
mv -T "$WEB_DIR/current.new" "$WEB_DIR/current"
systemctl restart despacha-api

log "7/7 verificação de saúde"
for _ in $(seq 1 20); do
    if curl -fsS -m 3 http://127.0.0.1:8000/api/v1/health | grep -q '"status":"ok"'; then
        log "API saudável"
        # Mantém só as últimas versões do frontend.
        find "$WEB_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
            | sort -rn | tail -n +$((RELEASES_TO_KEEP + 1)) | cut -d' ' -f2- | xargs -r rm -rf
        # Scripts de operação (backup/restore/deploy) rodam como root e por isso
        # NÃO são atualizados automaticamente: revise a diferença e reinstale.
        for script in backup restore restore-test deploy cli; do
            if ! cmp -s "$APP_DIR/deploy/scripts/${script}.sh" "/usr/local/sbin/despacha-${script}"; then
                log "ATENÇÃO: deploy/scripts/${script}.sh mudou — revise e reinstale (README, 'Scripts de operação')"
            fi
        done
        log "deploy concluído: ${previous_commit} → ${current_commit}"
        exit 0
    fi
    sleep 2
done

log "ERRO: a API não respondeu saudável após o deploy"
if [[ -n "$previous_release" ]]; then
    ln -sfn "$previous_release" "$WEB_DIR/current.new" && mv -T "$WEB_DIR/current.new" "$WEB_DIR/current"
    log "frontend voltou para $(basename "$previous_release")"
fi
log "código anterior: ${previous_commit}. Veja: journalctl -u despacha-api -n 100"
exit 1
