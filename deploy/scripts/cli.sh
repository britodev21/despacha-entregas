#!/usr/bin/env bash
# DESPACHA — comandos administrativos (python -m app.cli) no contêiner da API.
# Atalho sugerido: ln -s /docker/despacha/deploy/scripts/cli.sh /usr/local/sbin/despacha-cli
#
#   despacha-cli create-company --name "<NOME_DA_EMPRESA>"
#   despacha-cli create-user --company-id <ID> --name "<NOME>" \
#       --email <EMAIL> --role ADMIN --password-stdin
#   despacha-cli purge-locations

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/docker/despacha}"

# Sem terminal (timer do systemd, senha via pipe): -T repassa a entrada padrão.
tty_flag=()
[[ -t 0 ]] || tty_flag=(-T)

exec docker compose --project-directory "$APP_DIR" exec "${tty_flag[@]}" api python -m app.cli "$@"
