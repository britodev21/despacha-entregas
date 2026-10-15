# DESPACHA — Produção (runbook)

Passo a passo para colocar o DESPACHA num servidor Linux com **Docker** e
**Traefik**, que pode ser compartilhado com outros sistemas, e operá-lo com
segurança: instalação, HTTPS, backup cifrado com teste de restauração,
atualização e rollback.

> **Repositório público.** Nada de domínio, IP, porta SSH, usuário, e-mail ou
> senha neste arquivo nem em nenhum outro versionado. Onde aparecer
> `<SEU_DOMINIO>` etc., troque **só no servidor**.

## Sumário

1. [Arquitetura de produção](#1-arquitetura-de-produção)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Instalar](#3-instalar)
4. [Primeiro acesso](#4-primeiro-acesso)
5. [Backup cifrado](#5-backup-cifrado)
6. [Manutenção diária e timers](#6-manutenção-diária-e-timers)
7. [Monitoramento e logs](#7-monitoramento-e-logs)
8. [Atualizar (deploy)](#8-atualizar-deploy)
9. [Rollback](#9-rollback)
10. [Restauração em caso de desastre](#10-restauração-em-caso-de-desastre)
11. [Checklist pós-deploy](#11-checklist-pós-deploy)
12. [Problemas comuns](#12-problemas-comuns)

---

## 1. Arquitetura de produção

```
internet ──443──► Traefik (já existe no servidor: HTTPS + Let's Encrypt)
                     │  rede despacha-borda
                     ▼
                  web  (Nginx sem root :8080 — estáticos, headers, rate limit)
                     │  /api/
                     ▼
                  api  (FastAPI/Uvicorn, sem root, disco somente leitura)
                     │  rede despacha-interna (sem saída para a internet)
                     ▼
                  db   (PostgreSQL 18)          migrate (roda e termina)
```

| Contêiner | O que faz | Exposição |
|---|---|---|
| `db` | PostgreSQL, com volume `banco` | só a rede interna |
| `migrate` | `alembic upgrade head` a cada subida; **único** com a credencial do dono do schema | só a rede interna |
| `api` | API, com volume `uploads` (fotos e assinaturas) | redes interna e borda; nenhuma porta publicada |
| `web` | build do React + Nginx | só o Traefik o alcança (etiquetas no compose) |

**Princípios** (detalhes em [docs/ARQUITETURA.md](../docs/ARQUITETURA.md), seção 20):

- Só o Traefik recebe a internet. Nenhum contêiner do DESPACHA publica porta.
- A API usa o usuário de banco `despacha_app` (só DML). A credencial do dono
  do schema existe apenas no contêiner `migrate`, que termina logo depois.
- Contêineres sem root, com disco somente leitura, sem capabilities e com
  `no-new-privileges`. A API só grava no volume de uploads.
- Logs do Docker com limite de tamanho, para não encher o disco.

## 2. Pré-requisitos

| | Como conferir |
|---|---|
| Acesso SSH ao servidor (com chave) | `ssh <usuario>@<servidor>` entra |
| Docker e Docker Compose v2 | `docker compose version` |
| Traefik rodando, com provider Docker | `docker ps` mostra o contêiner do Traefik |
| Subdomínio apontando para o servidor | `getent hosts <SEU_DOMINIO>` mostra o IP do servidor |

Confira na configuração do Traefik o nome do entrypoint HTTPS e o do
certresolver (os padrões no `.env.example` são `websecure` e
`letsencrypt`).

Crie o registro DNS (A) **antes** de subir. Sem ele, o Let's Encrypt não emite
o certificado.

## 3. Instalar

```bash
# Código (repositório público: clone por HTTPS, sem chave de deploy)
git clone https://github.com/<USUARIO>/<REPOSITORIO>.git /docker/despacha
cd /docker/despacha

# Configuração: segredos gerados AQUI, direto no arquivo (nada aparece na tela)
umask 077
cp .env.example .env
for var in POSTGRES_PASSWORD DESPACHA_OWNER_PASSWORD DESPACHA_APP_PASSWORD; do
  printf 's|^%s=.*|%s=%s|\n' "$var" "$var" "$(openssl rand -hex 24)"
done | sed -i -f /dev/stdin .env
printf 's|^JWT_SECRET=.*|JWT_SECRET=%s|\n' "$(openssl rand -hex 32)" | sed -i -f /dev/stdin .env
nano .env        # troque DOMINIO; confira TRAEFIK_ENTRYPOINT e TRAEFIK_CERTRESOLVER
grep -c '<' .env # deve dar 0 (nenhum placeholder sobrando)

# Subir: build das imagens, banco, migrations, API e tela
docker compose up -d --build
docker compose ps    # db e api "healthy", web "healthy", migrate "exited (0)"
```

O certificado sai no primeiro acesso ao domínio, o que pode levar até um
minuto. Abra `https://<SEU_DOMINIO>` e confira o cadeado.

**Atalho para a CLI** (opcional):

```bash
ln -s /docker/despacha/deploy/scripts/cli.sh /usr/local/sbin/despacha-cli
```

## 4. Primeiro acesso

Crie a empresa e o primeiro administrador. A senha é digitada sem aparecer na
tela e entra pela entrada padrão, nunca como argumento:

```bash
despacha-cli create-company --name "<NOME_DA_EMPRESA>"
# → Empresa criada: ... (<ID_DA_EMPRESA>)

read -rsp "Senha do administrador: " PW; echo
printf '%s\n' "$PW" | despacha-cli create-user --company-id <ID_DA_EMPRESA> \
  --name "<NOME>" --email <EMAIL> --role ADMIN --password-stdin
unset PW
```

Operadores e entregadores são criados pela tela **Usuários** do sistema.

## 5. Backup cifrado

**O que entra:** o banco (`pg_dump` formato custom) e o volume de uploads, num
único arquivo cifrado com [age](https://age-encryption.org). A cópia para fora
do servidor (`rclone`) é opcional.

**Duas chaves públicas** (o arquivo pode ser aberto por qualquer uma):

- **Chave do dono**: gerada no **seu computador**, nunca no servidor. Guarde a
  chave privada num gerenciador de senhas e numa cópia offline. É ela que
  recupera tudo se o servidor for perdido.
- **Chave do servidor**: permite o teste automático de restauração. Quem tem
  root no servidor consegue abrir o backup, mas essa pessoa já acessa o banco
  ao vivo. A cifra protege a **cópia externa**.

```bash
# No SEU computador:
age-keygen -o despacha-backup-dono.agekey   # guarde com segurança; anote a "public key"

# No servidor:
apt install -y age
install -d -m 700 /etc/despacha /root/backups/despacha
age-keygen -o /etc/despacha/backup-server.agekey && chmod 600 /etc/despacha/backup-server.agekey
{ echo "<CHAVE_PUBLICA_DO_DONO>"; age-keygen -y /etc/despacha/backup-server.agekey; } \
  > /etc/despacha/backup-recipients.txt
install -m 600 /docker/despacha/deploy/env/backup.env.example /etc/despacha/backup.env
nano /etc/despacha/backup.env    # opcional: RCLONE_REMOTE e URLs de monitoramento

# Teste agora, não no dia do desastre:
/docker/despacha/deploy/scripts/backup.sh
/docker/despacha/deploy/scripts/restore-test.sh    # deve terminar com "OK: migration ..."
```

O teste de restauração sobe um PostgreSQL **temporário e sem rede**, restaura
o backup, confere a versão das migrations e as contagens, e apaga o
contêiner. A produção não é tocada.

**Retenção:** 14 dias no servidor (`RETENTION_DAYS`). No destino externo,
configure retenção e proteção contra exclusão no próprio provedor. Assim, um
invasor no servidor não consegue apagar os backups antigos.

## 6. Manutenção diária e timers

```bash
cp /docker/despacha/deploy/systemd/despacha-* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now despacha-backup.timer despacha-maintenance.timer despacha-restore-test.timer
systemctl list-timers 'despacha-*'
```

| Timer | O que faz | Quando |
|---|---|---|
| `despacha-backup` | backup cifrado (+ cópia externa, se configurada) | diário, 03:45 |
| `despacha-maintenance` | apaga posições antigas (LGPD) e sessões vencidas | diário, 04:15 |
| `despacha-restore-test` | restaura o último backup num banco temporário e confere | dia 1, 05:00 |

Os timers usam `Persistent=true`: se o servidor estava desligado no horário,
a tarefa roda assim que ele volta.

## 7. Monitoramento e logs

- **Disponibilidade:** cadastre `https://<SEU_DOMINIO>/api/v1/health` num
  monitor externo de uptime. Ele responde 200 com `"status":"ok"`, ou 503 se o
  banco cair.
- **Tarefas agendadas:** `HEALTHCHECK_URL` e `RESTORE_TEST_HEALTHCHECK_URL`
  (no `backup.env`) recebem um ping a cada execução bem-sucedida.
- **Logs:**

  ```bash
  cd /docker/despacha
  docker compose logs -f api                    # cada linha tem o request_id
  docker compose logs --since 1h web
  journalctl -u despacha-backup -u despacha-maintenance --since "-2d"
  ```

- **Auditoria de negócio** (quem fez o quê): tela **Auditoria** do sistema.

## 8. Atualizar (deploy)

```bash
/docker/despacha/deploy/scripts/deploy.sh
```

O script, na ordem:

1. faz um backup, se já estiver configurado;
2. roda `git pull --ff-only`;
3. faz o build das imagens (`--pull` traz correções de segurança das imagens base);
4. roda `docker compose up -d`: o `migrate` aplica as migrations e só depois
   a API e a tela são trocadas;
5. confere a saúde passando pelo Nginx.

Se as migrations falharem, a API antiga continua no ar.

**Regra para migrations:** por alguns segundos, o código antigo convive com o
schema novo. Toda migration precisa ser compatível com a versão anterior do
código (*expand → contract*):

- **Adicionar uma coluna:** crie a coluna como nula ou com default.
- **Remover uma coluna:** primeiro faça um deploy que pare de usá-la; só no
  deploy seguinte a coluna é removida.

Uma aba aberta antes do deploy recarrega sozinha ao abrir uma tela nova. Os
arquivos antigos deixam de existir, e o frontend trata isso.

## 9. Rollback

**Quando o deploy não trouxe migration:**

```bash
cd /docker/despacha
git checkout <COMMIT_ANTERIOR>     # o deploy.sh mostra qual era
docker compose up -d --build
# depois de corrigir: git checkout main && deploy/scripts/deploy.sh
```

**Quando o deploy trouxe migration:**

- Prefira **corrigir para frente** com um novo commit.
- Se precisar voltar o schema, rode
  `docker compose run --rm migrate alembic downgrade <REVISAO>`. Só funciona
  se a migration tiver um `downgrade` correto.
- **Último recurso:** use o backup feito no início do deploy, seguindo a
  seção 10. Ele perde o que aconteceu depois do backup.

## 10. Restauração em caso de desastre

Servidor perdido ou banco corrompido, numa instalação **nova**:

1. Siga a seção 3, mas suba **só o banco**: `docker compose up -d db`. Ele
   cria os usuários e um banco `despacha` vazio.
2. Traga o backup (e o `.sha256`) e a **chave do dono**. A chave vai para um
   arquivo temporário, apagado no fim:

   ```bash
   rclone copy <REMOTE>:<CAMINHO>/<ARQUIVO>.tar.age /root/backups/despacha/
   install -m 600 /dev/stdin /root/dono.agekey   # cole a chave privada e tecle Ctrl+D
   ```

3. Restaure. O script exige a API parada e o banco vazio:

   ```bash
   /docker/despacha/deploy/scripts/restore.sh /root/backups/despacha/<ARQUIVO>.tar.age /root/dono.agekey
   shred -u /root/dono.agekey
   docker compose up -d
   ```

4. **Troque os segredos:** gere um novo `JWT_SECRET` no `.env` e rode
   `docker compose up -d`. Isso encerra as sessões antigas, e todos entram de
   novo.

**Banco corrompido no servidor atual:**

1. Pare a aplicação: `docker compose stop web api`.
2. Guarde o volume atual como cópia: `docker volume` / `pg_dump`.
3. Recrie o banco vazio e restaure como acima.

## 11. Checklist pós-deploy

- [ ] `curl -I https://<SEU_DOMINIO>` mostra HSTS, CSP, `X-Frame-Options`,
  `X-Content-Type-Options` e `Referrer-Policy`, sem a versão do Nginx.
- [ ] `http://<SEU_DOMINIO>` redireciona para HTTPS (o Traefik faz isso).
- [ ] `https://<SEU_DOMINIO>/api/docs` e `/api/openapi.json` retornam 404.
- [ ] `docker compose ps` mostra nenhuma porta publicada.
- [ ] `docker compose exec api env | grep MIGRATIONS` não mostra nada.
- [ ] O `.env` tem permissão 600 e nenhum placeholder sobrando.
- [ ] Login funciona, o refresh mantém a sessão e o logout encerra.
- [ ] No celular: o entregador abre a entrega, compartilha a localização (o
  navegador só libera com HTTPS), tira a foto e conclui.
- [ ] O mapa do operador mostra os tiles.
- [ ] O backup rodou e o teste de restauração passou (seção 5).
- [ ] O monitor externo de uptime está ativo.

## 12. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Sem cadeado / erro de certificado | DNS não aponta para o servidor, ou nome do certresolver errado | `getent hosts <SEU_DOMINIO>`; `docker logs <contêiner do traefik>` |
| 404 do Traefik no domínio | Etiquetas não lidas: `DOMINIO` errado ou rede diferente | `docker compose config` e confira as labels do `web` |
| `migrate` com erro de senha | Senhas do `.env` só valem na **criação** do volume do banco | Para trocar depois: `ALTER ROLE ... PASSWORD` no banco e depois no `.env` |
| `web` não sobe | A API não ficou saudável | `docker compose logs api migrate` |
| Todo mundo bloqueado no login ("muitas tentativas") | IP real não chegou (todos parecem o mesmo IP) | Confira o `X-Forwarded-For` que o Traefik envia e o `set_real_ip_from` do `frontend/nginx.conf` |
| Mapa cinza | Origem dos tiles fora da CSP | `MAP_TILE_ORIGIN` no `.env` e `docker compose up -d --build web` |
