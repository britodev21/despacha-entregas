#!/usr/bin/env bash
# DESPACHA — comandos administrativos (python -m app.cli) com a configuração
# de produção. Instalado como /usr/local/sbin/despacha-cli.
#
#   sudo despacha-cli create-company --name "<NOME_DA_EMPRESA>"
#   sudo despacha-cli create-user --company-id <ID> --name "<NOME>" \
#       --email <EMAIL> --role ADMIN --password-stdin
#
# Roda como `despacha`, num processo isolado, lendo o backend.env com o mesmo
# parser do serviço da API. A entrada padrão é repassada (--password-stdin).

set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo "rode como root (sudo)" >&2; exit 1; }

APP_DIR=/opt/despacha/app

exec systemd-run --quiet --wait --pipe --collect \
    --uid=despacha --gid=despacha \
    -p WorkingDirectory="$APP_DIR/backend" \
    -p EnvironmentFile=/etc/despacha/backend.env \
    -p NoNewPrivileges=yes -p ProtectSystem=strict -p PrivateTmp=yes \
    "$APP_DIR/backend/.venv/bin/python" -m app.cli "$@"
