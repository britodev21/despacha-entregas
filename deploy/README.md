# DESPACHA — Produção (runbook)

Passo a passo para colocar o DESPACHA num VPS Linux e operá-lo com segurança:
instalação, HTTPS, backup cifrado com teste de restauração, atualização e
rollback.

> **Repositório público.** Nada de domínio, IP, porta SSH, usuário, e-mail ou
> senha neste arquivo nem em nenhum outro versionado. Onde aparecer
> `<SEU_DOMINIO>`, `<PROVEDOR_DE_TILES>` etc., troque **só no servidor**.

## Sumário

1. [Arquitetura de produção](#1-arquitetura-de-produção)
2. [Preparar o servidor](#2-preparar-o-servidor)
3. [Instalar dependências](#3-instalar-dependências)
4. [Usuário, pastas e código](#4-usuário-pastas-e-código)
5. [Banco de dados e segredos](#5-banco-de-dados-e-segredos)
6. [Scripts de operação](#6-scripts-de-operação)
7. [Primeira instalação da aplicação](#7-primeira-instalação-da-aplicação)
8. [HTTPS e Nginx](#8-https-e-nginx)
9. [Serviços (systemd)](#9-serviços-systemd)
10. [Primeiro acesso](#10-primeiro-acesso)
11. [Backup cifrado](#11-backup-cifrado)
12. [Monitoramento e logs](#12-monitoramento-e-logs)
13. [Atualizar (deploy)](#13-atualizar-deploy)
14. [Rollback](#14-rollback)
15. [Restauração em caso de desastre](#15-restauração-em-caso-de-desastre)
16. [Checklist pós-deploy](#16-checklist-pós-deploy)

---

## 1. Arquitetura de produção

```
Internet ──443──► Nginx ─┬─ /          → /var/www/despacha/current (build do React)
          (80 → 443)     └─ /api/      → Uvicorn 127.0.0.1:8000 (FastAPI, usuário despacha)
                                              │
                                              ▼
                                       PostgreSQL (só localhost)

systemd timers: backup diário · manutenção diária (LGPD) · teste de restauração mensal
```

| Caminho | Conteúdo | Dono / permissão |
|---|---|---|
| `/opt/despacha/app` | checkout do git, `.venv`, `node_modules` (nada secreto) | `despacha`, 755 |
| `/var/lib/despacha/uploads` | fotos e assinaturas dos comprovantes | `despacha`, 750 |
| `/var/www/despacha/releases/*` | builds do frontend (o Nginx serve `current`) | `root`, 755 |
| `/var/www/acme` | desafios do Let's Encrypt | `root`, 755 |
| `/etc/despacha/*.env` | segredos e configuração | `root`, 600 (`frontend.env`: 644) |
| `/var/backups/despacha` | backups cifrados locais | `root`, 700 |
| `/usr/local/sbin/despacha-*` | scripts de operação (rodam como root) | `root`, 750 |

**Princípios** (detalhes em [docs/ARQUITETURA.md](../docs/ARQUITETURA.md), seção 20):

- Só o Nginx fica exposto. A API e o banco escutam apenas em `127.0.0.1`.
- A API roda como usuário sem privilégios, num sandbox do systemd em que o
  disco é somente leitura (exceto a pasta de uploads).
- A API usa o usuário de banco `despacha_app` (só DML). A credencial do dono do
  schema (`migrations.env`) só existe durante as migrations.
- O root nunca executa código do checkout: os scripts que rodam como root são
  **copiados** para `/usr/local/sbin` depois de revisados.

## 2. Preparar o servidor

Ubuntu Server LTS recente, com acesso SSH por chave já funcionando.

```bash
sudo apt update && sudo apt full-upgrade -y
sudo timedatectl set-timezone UTC   # o app converte para o fuso de cada empresa
```

**SSH só com chave, sem root.** Antes de aplicar, confirme que você entra com
chave num usuário com `sudo`, e **mantenha uma sessão aberta** enquanto testa
outra.

```bash
sudo tee /etc/ssh/sshd_config.d/10-despacha.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sudo sshd -t && sudo systemctl reload ssh
```

**Firewall**: só SSH, HTTP e HTTPS. Se o SSH usa outra porta, libere-a
**antes** de ativar.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

**Proteção contra força bruta e atualizações automáticas de segurança:**

```bash
sudo apt install -y fail2ban unattended-upgrades
sudo systemctl enable --now fail2ban          # a jail do sshd vem ativa
sudo dpkg-reconfigure -plow unattended-upgrades
```

**Logs com limite** (os logs têm IPs, que são dados pessoais pela LGPD):

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/despacha.conf > /dev/null <<'EOF'
[Journal]
SystemMaxUse=500M
MaxRetentionSec=1month
EOF
sudo systemctl restart systemd-journald
```

## 3. Instalar dependências

```bash
sudo apt install -y nginx certbot git curl age rclone
```

- **PostgreSQL 18**: pacote da distribuição se for a versão 18; senão, o
  repositório oficial (PGDG): `sudo apt install -y postgresql-common &&
  sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh`, e então
  `sudo apt install -y postgresql-18`. Por padrão ele só escuta em `localhost`:
  mantenha assim.
- **Node.js 24 LTS** (só para o build do frontend): pacote da distribuição se
  atender `^22.22 || ^24.15`, ou o repositório oficial do NodeSource.
- **uv** (gerencia Python 3.14 e as dependências do backend), instalado para
  todos os usuários:

  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sudo env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh
  ```

  Se preferir não executar um script baixado, use o binário da página de
  releases do uv e confira o checksum.

## 4. Usuário, pastas e código

```bash
# Usuário de sistema, sem login. A home guarda o Python e os caches do uv/npm.
# Nada ali é secreto (o código é público; segredos ficam em /etc/despacha).
sudo useradd --system --create-home --home-dir /opt/despacha --shell /usr/sbin/nologin despacha
sudo chmod 755 /opt/despacha

sudo install -d -o despacha -g despacha -m 750 /var/lib/despacha/uploads
sudo install -d -o root -g root -m 755 /var/www/despacha/releases /var/www/acme
sudo install -d -o root -g root -m 755 /etc/despacha
sudo install -d -o root -g root -m 700 /var/backups/despacha

# Repositório público: clone por HTTPS, sem chave de deploy.
sudo -u despacha -H git clone https://github.com/<USUARIO>/<REPOSITORIO>.git /opt/despacha/app
```

## 5. Banco de dados e segredos

As senhas são geradas **no servidor** e vão direto para os arquivos de
ambiente. Nada aparece na tela nem na lista de processos: `echo` e `printf` são
internos do shell, e o `sed` recebe o comando pela entrada padrão, não como
argumento.

```bash
cd /opt/despacha/app
sudo -s   # shell de root para os passos abaixo

OWNER_PW="$(openssl rand -hex 24)"
APP_PW="$(openssl rand -hex 24)"

{
  echo "\\set owner_password '$OWNER_PW'"
  echo "\\set app_password '$APP_PW'"
  echo "\\set db_name despacha"
  cat backend/scripts/setup_db.sql
} | runuser -u postgres -- psql -X

# Segredos da API (modelo comentado em deploy/env/backend.env.example)
install -m 600 deploy/env/backend.env.example /etc/despacha/backend.env
printf 's|<SENHA_APP>|%s|\ns|<GERE_UM_SEGREDO_ALEATORIO>|%s|\n' "$APP_PW" "$(openssl rand -hex 32)" \
  | sed -i -f /dev/stdin /etc/despacha/backend.env

# Credencial do dono do schema: só para migrations
install -m 600 deploy/env/migrations.env.example /etc/despacha/migrations.env
printf 's|<SENHA_OWNER>|%s|\n' "$OWNER_PW" | sed -i -f /dev/stdin /etc/despacha/migrations.env

# Build do frontend (público): edite e troque os placeholders
install -m 644 deploy/env/frontend.env.example /etc/despacha/frontend.env

# Backup: edite depois, na seção 11
install -m 600 deploy/env/backup.env.example /etc/despacha/backup.env

unset OWNER_PW APP_PW
exit
```

Confira com `sudo grep -c '<' /etc/despacha/backend.env /etc/despacha/migrations.env`:
o resultado deve ser 0 (nenhum placeholder sobrando).

## 6. Scripts de operação

Rodam como root, então ficam fora do checkout (que pertence ao usuário
`despacha`). Instale agora e **reinstale a cada mudança**, depois de revisar a
diferença. O `despacha-deploy` avisa quando algum mudou.

```bash
cd /opt/despacha/app/deploy/scripts
for s in backup restore restore-test deploy cli; do
  sudo install -o root -g root -m 750 "$s.sh" "/usr/local/sbin/despacha-$s"
done

# Ao atualizar: revise antes de reinstalar
diff -u /usr/local/sbin/despacha-backup backup.sh
```

| Comando | Para quê |
|---|---|
| `despacha-deploy` | atualizar a aplicação (seção 13) |
| `despacha-cli` | comandos administrativos (`create-company`, `create-user`...) |
| `despacha-backup` | backup cifrado (o timer roda todo dia) |
| `despacha-restore` | restaurar um backup num banco **novo** |
| `despacha-restore-test` | testar o último backup (o timer roda todo mês) |

## 7. Primeira instalação da aplicação

```bash
cd /opt/despacha/app

# Backend: Python 3.14 e dependências travadas no uv.lock
cd backend && sudo -u despacha -H uv sync --frozen --no-dev --compile-bytecode && cd ..

# Migrations (com a credencial do dono, só neste processo)
sudo systemd-run --quiet --wait --pipe --collect --uid=despacha --gid=despacha \
  -p WorkingDirectory=/opt/despacha/app/backend \
  -p EnvironmentFile=/etc/despacha/backend.env \
  -p EnvironmentFile=/etc/despacha/migrations.env \
  /opt/despacha/app/backend/.venv/bin/alembic upgrade head

# Frontend
cd frontend
sudo -u despacha -H cp /etc/despacha/frontend.env .env.production.local
sudo -u despacha -H npm ci --ignore-scripts --no-audit --no-fund
sudo -u despacha -H npm run build
release="/var/www/despacha/releases/$(date +%Y%m%d-%H%M%S)-inicial"
sudo mkdir -p "$release" && sudo cp -a dist/. "$release/" && sudo chown -R root:root "$release"
sudo ln -sfn "$release" /var/www/despacha/current
```

Depois disso, as atualizações usam só o `despacha-deploy`.

## 8. HTTPS e Nginx

O site é renovado pelo modo **webroot**, que não derruba o Nginx. Só a
primeira emissão usa o modo standalone: o Nginx para por alguns segundos, já
que o site ainda não está no ar.

Antes, crie o registro DNS (A/AAAA) do `<SEU_DOMINIO>` apontando para o
servidor.

```bash
# 1. Primeira emissão
sudo systemctl stop nginx
sudo certbot certonly --standalone -d <SEU_DOMINIO> --agree-tos -m <SEU_EMAIL> --no-eff-email
sudo systemctl start nginx

# 2. Configuração do site (troque os placeholders nos arquivos copiados)
sudo cp /opt/despacha/app/deploy/nginx/despacha-ratelimit.conf /etc/nginx/conf.d/
sudo cp /opt/despacha/app/deploy/nginx/despacha.conf /etc/nginx/sites-available/despacha
DOMINIO='<SEU_DOMINIO>'; TILES='<PROVEDOR_DE_TILES>'   # valores reais, digitados só no servidor
sudo sed -i "s/<SEU_DOMINIO>/$DOMINIO/g; s/<PROVEDOR_DE_TILES>/$TILES/g" /etc/nginx/sites-available/despacha
sudo ln -s /etc/nginx/sites-available/despacha /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 3. Renovação passa a usar webroot e recarrega o Nginx após renovar
sudo certbot reconfigure --cert-name <SEU_DOMINIO> --webroot --webroot-path /var/www/acme
sudo install -m 755 /dev/stdin /etc/letsencrypt/renewal-hooks/deploy/reload-nginx <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
sudo certbot renew --dry-run
```

O domínio dos tiles do mapa precisa ser o mesmo em dois lugares: no
`frontend.env` (`VITE_MAP_TILE_URL`) e na CSP do Nginx (`img-src`).

## 9. Serviços (systemd)

```bash
sudo cp /opt/despacha/app/deploy/systemd/despacha-* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now despacha-api
sudo systemctl enable --now despacha-maintenance.timer despacha-backup.timer despacha-restore-test.timer

systemctl status despacha-api
systemctl list-timers 'despacha-*'
curl -s http://127.0.0.1:8000/api/v1/health     # {"status":"ok","database":"ok"}
```

| Unit | O que faz | Quando |
|---|---|---|
| `despacha-api.service` | API (2 workers Uvicorn, sandbox) | sempre |
| `despacha-maintenance.timer` | apaga posições antigas (LGPD) e sessões vencidas | diário, 04:15 |
| `despacha-backup.timer` | backup cifrado + cópia externa | diário, 03:30 |
| `despacha-restore-test.timer` | restaura o último backup num banco temporário e confere | dia 1, 05:00 |

## 10. Primeiro acesso

Crie a empresa e o primeiro administrador. A senha é digitada sem aparecer na
tela e entra pela entrada padrão, nunca como argumento:

```bash
sudo despacha-cli create-company --name "<NOME_DA_EMPRESA>"
# → Empresa criada: ... (<ID_DA_EMPRESA>)

read -rsp "Senha do administrador: " PW; echo
printf '%s\n' "$PW" | sudo despacha-cli create-user --company-id <ID_DA_EMPRESA> \
  --name "<NOME>" --email <EMAIL> --role ADMIN --password-stdin
unset PW
```

Os demais usuários (operadores e entregadores) são criados pela tela
**Usuários** do próprio sistema.

## 11. Backup cifrado

**O que entra:** o banco (`pg_dump` formato custom) e a pasta de uploads, num
único arquivo cifrado com [age](https://age-encryption.org) e copiado para
fora do servidor com `rclone`.

**Duas chaves públicas** (o arquivo pode ser aberto por qualquer uma):

- **Chave do dono**: gerada no **seu computador**, nunca no servidor. Guarde a
  chave privada num gerenciador de senhas e numa cópia offline. É ela que
  recupera tudo se o servidor for perdido.
- **Chave do servidor**: permite o teste automático de restauração. Quem tem
  root no servidor consegue abrir o backup, mas essa pessoa já teria acesso ao
  banco ao vivo. A cifra protege a **cópia externa**: o provedor de
  armazenamento só vê dados ilegíveis.

```bash
# No SEU computador (não no servidor):
age-keygen -o despacha-backup-dono.agekey   # guarde com segurança; anote a linha "public key"

# No servidor:
sudo age-keygen -o /etc/despacha/backup-server.agekey
sudo chmod 600 /etc/despacha/backup-server.agekey
{ echo "<CHAVE_PUBLICA_DO_DONO>"; sudo age-keygen -y /etc/despacha/backup-server.agekey; } \
  | sudo tee /etc/despacha/backup-recipients.txt > /dev/null

# Destino externo (bucket S3 compatível, outro servidor, etc.)
sudo rclone config                      # crie o remote; a config fica em /root
sudo nano /etc/despacha/backup.env      # RCLONE_REMOTE e, opcionalmente, HEALTHCHECK_URL

# Teste agora, não no dia do desastre:
sudo systemctl start despacha-backup && journalctl -u despacha-backup -n 20
sudo systemctl start despacha-restore-test && journalctl -u despacha-restore-test -n 20
```

O teste de restauração deve terminar com `OK: migration ...`. Se falhar, o
`systemctl status despacha-restore-test` mostra `failed`. Configure o
`RESTORE_TEST_HEALTHCHECK_URL` para ser avisado.

**Retenção:** 14 dias no servidor (`RETENTION_DAYS`). No destino externo,
configure a retenção ou o versionamento no próprio provedor, de preferência
com proteção contra exclusão. Assim, um invasor no servidor não consegue
apagar os backups antigos.

## 12. Monitoramento e logs

- **Disponibilidade:** cadastre `https://<SEU_DOMINIO>/api/v1/health` num
  monitor externo de uptime. Ele responde 200 com `"status":"ok"`, ou 503 se o
  banco cair.
- **Tarefas agendadas:** `HEALTHCHECK_URL` e `RESTORE_TEST_HEALTHCHECK_URL`
  (no `backup.env`) recebem um ping a cada execução bem-sucedida. Se o ping
  não chegar, o serviço de monitoramento avisa.
- **Logs:**

  ```bash
  journalctl -u despacha-api -f                 # API ao vivo (cada linha tem o request_id)
  journalctl -u despacha-api -p warning --since today
  journalctl -u despacha-backup -u despacha-maintenance --since "-2d"
  ```

- **Auditoria de negócio** (quem fez o quê): tela **Auditoria** do sistema.

## 13. Atualizar (deploy)

```bash
sudo despacha-deploy
```

O script, na ordem:

1. faz um backup;
2. roda `git pull --ff-only`;
3. roda `uv sync --frozen`;
4. aplica as migrations;
5. faz o build do frontend numa pasta nova;
6. troca o frontend de forma atômica e reinicia a API;
7. confere a saúde da API.

Se a API não ficar saudável, o frontend volta sozinho para a versão anterior
e o script termina com erro, mostrando o commit anterior.

**Regra para migrations:** as migrations rodam **antes** do reinício. Por
alguns segundos, o código antigo convive com o schema novo. Toda migration
precisa ser compatível com a versão anterior do código (*expand → contract*):

- **Adicionar uma coluna:** crie a coluna como nula ou com default.
- **Remover uma coluna:** primeiro faça um deploy que pare de usá-la; só no
  deploy seguinte a coluna é removida.

## 14. Rollback

**Só o frontend** (troca instantânea):

```bash
ls -1t /var/www/despacha/releases/                       # versões disponíveis
sudo ln -sfn /var/www/despacha/releases/<VERSAO> /var/www/despacha/current.new
sudo mv -T /var/www/despacha/current.new /var/www/despacha/current
```

**Backend, quando o deploy não trouxe migration:**

```bash
cd /opt/despacha/app
sudo -u despacha -H git checkout <COMMIT_ANTERIOR>
cd backend && sudo -u despacha -H uv sync --frozen --no-dev --compile-bytecode
sudo systemctl restart despacha-api
# Depois de corrigir: sudo -u despacha -H git checkout main && sudo despacha-deploy
```

**Backend, quando o deploy trouxe migration:**

- Prefira **corrigir para frente** com um novo commit.
- Se precisar voltar o schema, use `alembic downgrade <REVISAO>`, com o mesmo
  `systemd-run` da seção 7. Só funciona se a migration tiver um `downgrade`
  correto.
- **Último recurso:** use o backup feito no início do deploy. Ele perde o que
  aconteceu depois dele. Siga a seção 15, restaurando num banco novo e
  trocando os nomes.

## 15. Restauração em caso de desastre

Servidor perdido ou banco corrompido:

1. **Servidor novo:** siga as seções 2 a 6. O `setup_db.sql` cria os usuários
   do banco e um banco `despacha` vazio.
2. **Traga o backup** e a **chave do dono**. A chave vai para um arquivo
   temporário, apagado no fim:

   ```bash
   sudo rclone copy <REMOTE>:<BUCKET>/despacha/<ARQUIVO>.tar.age /var/backups/despacha/
   sudo rclone copy <REMOTE>:<BUCKET>/despacha/<ARQUIVO>.tar.age.sha256 /var/backups/despacha/
   sudo install -m 600 /dev/stdin /root/dono.agekey   # cole a chave privada e tecle Ctrl+D
   ```

3. **Restaure** num banco que não existe. O script recusa sobrescrever:

   ```bash
   sudo runuser -u postgres -- dropdb despacha    # o banco vazio do passo 1
   sudo despacha-restore /var/backups/despacha/<ARQUIVO>.tar.age despacha \
     /var/lib/despacha/uploads /root/dono.agekey
   sudo chown -R despacha:despacha /var/lib/despacha/uploads
   sudo shred -u /root/dono.agekey
   ```

4. Siga a seção 7, que roda `alembic upgrade head` caso o código seja mais novo
   que o backup, e depois as seções 8 a 9.
5. **Troque os segredos:** gere um novo `JWT_SECRET`. Isso encerra as sessões
   antigas, e todos entram de novo.

**Corrupção no servidor atual** (o banco existe): restaure com outro nome
(`despacha_restaurado`) e confira os dados. Então pare a API e troque os
nomes:

```sql
ALTER DATABASE despacha RENAME TO despacha_antigo;
ALTER DATABASE despacha_restaurado RENAME TO despacha;
```

Depois, inicie a API.

## 16. Checklist pós-deploy

- [ ] `curl -I https://<SEU_DOMINIO>` mostra HSTS, CSP, `X-Frame-Options`,
  `X-Content-Type-Options` e `Referrer-Policy`, sem a versão do Nginx.
- [ ] `curl -I http://<SEU_DOMINIO>` retorna 301 para HTTPS.
- [ ] `https://<SEU_DOMINIO>/api/docs` e `/api/openapi.json` retornam 404.
- [ ] `sudo ss -tlnp` mostra 5432 e 8000 só em `127.0.0.1`; só 22, 80 e 443
  ficam públicos.
- [ ] `/etc/despacha/backend.env` tem `APP_ENV=production`, sem
  `DEV_SEED_PASSWORD` e sem `MIGRATIONS_DATABASE_URL`.
- [ ] `stat -c '%a %U' /etc/despacha/*.env` mostra 600 para os segredos.
- [ ] Login funciona, o refresh mantém a sessão e o logout encerra.
- [ ] No celular: o entregador abre a entrega, compartilha a localização, tira
  a foto e conclui.
- [ ] O backup rodou e o teste de restauração passou (seção 11).
- [ ] O monitor externo de uptime está ativo.
- [ ] O teste do SSL (por exemplo, SSL Labs) dá nota A ou superior.
