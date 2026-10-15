# DESPACHA — Revisão de Segurança (Fase 9)

> Revisão feita ao fim da fase 9, antes da preparação para produção.
> Atualizada na fase 10: pendências de produção resolvidas (seção 5).
> Repositório público: este documento descreve **controles**, nunca dados de
> infraestrutura (IPs, domínios, usuários, portas).

## 1. Método

- Revisão manual guiada pelo **OWASP Top 10 (2021)**, cobrindo backend,
  frontend e a interação entre os dois.
- Ferramentas automáticas:

| Ferramenta | O que verifica | Resultado |
|---|---|---|
| `ruff --select S` (regras do Bandit) | Padrões inseguros em Python (SQL textual, `eval`, segredos fixos, `assert` em produção…) | Sem alertas |
| `pip-audit` | Vulnerabilidades conhecidas nas dependências Python (base OSV/PyPI) | Nenhuma conhecida |
| `npm audit --omit=dev` | Vulnerabilidades conhecidas nas dependências do frontend | 0 vulnerabilidades |
| Busca no código | `innerHTML`, `dangerouslySetInnerHTML`, `eval`, SQL com f-string, segredos versionados | Nenhuma ocorrência |
| Testes automatizados | 155 testes no backend e 45 no frontend; os de segurança cobrem IDOR entre empresas, papéis, tokens, upload malicioso, CSV injection e privacidade da localização | Todos passando |

Para repetir as verificações:

```bash
cd backend
uv run ruff check --select S .
uv export --no-hashes --no-dev --frozen > /tmp/req.txt && uvx pip-audit -r /tmp/req.txt
uv run pytest
cd ../frontend
npm audit --omit=dev
npm test
```

## 2. Controles por categoria (OWASP Top 10)

### A01 — Controle de acesso quebrado

- **Toda** rota protegida passa por `require_permission(...)` no backend. Os
  guards do frontend são só experiência de uso.
- Isolamento entre empresas: o `company_id` vem do token, nunca do corpo da
  requisição. Toda consulta filtra por ele, e o recurso de outra empresa
  responde **404**, sem confirmar que existe. Há testes de isolamento em
  usuários, clientes, entregas, arquivos, rastreamento, relatórios e
  exportação.
- O entregador usa rotas próprias (`/me/...`) filtradas por
  `deliverer_id = usuário logado`, e só executa os próprios passos.
- Endereço e arquivo são sempre buscados **dentro** do recurso pai já
  validado, então um id trocado na URL não é encontrado.
- O papel, o status ativo e a empresa são relidos do banco a cada requisição.
  Desativar alguém vale na hora.

### A02 — Falhas criptográficas

- Senhas com **Argon2id** (parâmetros mínimos da OWASP).
- Refresh token de 256 bits aleatórios. No banco fica só o SHA-256.
- O JWT é assinado com HS256 e algoritmo fixo na validação (o ataque com
  `alg=none` é testado), com `iss`, `aud`, `exp`, `iat` e `typ` obrigatórios.
- Segredos só em variáveis de ambiente. O `.env` não é versionado, e
  `JWT_SECRET` precisa ter no mínimo 32 caracteres.
- HTTPS obrigatório em produção (fase 10). O cookie é `Secure`.

### A03 — Injeção

- SQL apenas via ORM e consultas parametrizadas. Campos de busca usam
  `autoescape` (`%` e `_` viram texto literal).
- XSS: o React escapa por padrão. O único ponto com HTML cru, o marcador do
  mapa, usa `escapeHtml` (veja os achados abaixo).
- **CSV injection:** células iniciadas por `= + - @` são prefixadas com `'`
  na exportação.

### A04 — Design inseguro

- A máquina de estados da entrega fica num único lugar, com linha travada
  (`SELECT … FOR UPDATE`) a cada transição.
- O número da entrega é gerado de forma atômica (`UPDATE … RETURNING`).
- O upload é feito **antes** da finalização, que confere as exigências. Uma
  falha no meio nunca finaliza uma entrega sem comprovante.

### A05 — Configuração incorreta

- Erros com formato único e mensagem genérica. O stack trace fica só no log
  do servidor, junto com o `request_id`.
- O erro 422 **não ecoa** o valor enviado (protege senhas e dados pessoais).
- A documentação interativa (`/api/docs`) fica desligada em produção.
- Travas de produção: a aplicação recusa subir com CORS sem https ou com
  `DEV_SEED_PASSWORD` definido.
- Headers da API: `nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Cache-Control: no-store` e CSP
  `default-src 'none'`.

### A06 — Componentes vulneráveis

- `pip-audit` e `npm audit` estão sem achados. Os lockfiles (`uv.lock`,
  `package-lock.json`) são versionados para builds reproduzíveis.

### A07 — Falhas de identificação e autenticação

- Mensagem e **tempo de resposta** iguais para usuário inexistente, senha
  errada, conta bloqueada ou desativada (sem enumeração).
- Bloqueio progressivo por conta e rate limit por IP no login, no refresh e
  no envio de localização.
- Refresh com rotação e **detecção de reuso**: se um token já usado reaparece,
  a família inteira é revogada.
- Troca de senha, "sair de todos os dispositivos" e "encerrar sessões"
  invalidam também os access tokens já emitidos, sem esperar os 15 minutos.
- O access token fica só em memória. O refresh token fica em cookie
  `HttpOnly` + `SameSite=Strict` + `Path=/api/v1/auth`, com verificação de
  `Origin` (defesa contra CSRF).

### A08 — Integridade de dados e software

- Migrations versionadas, com um teste que falha se os models e as
  migrations divergirem.
- Upload: o tipo é validado pelo **conteúdo** (Pillow), há limite de tamanho
  e de pixels (decompression bomb), a imagem é **recodificada** (o EXIF com
  GPS é descartado) e o nome no disco é gerado pelo servidor.

### A09 — Falhas de log e monitoramento

- Auditoria **append-only**: o usuário do banco da API não tem
  `UPDATE`/`DELETE` em `audit_logs` (há teste disso).
- São registrados: login, falha, bloqueio, reuso de token, logout, troca de
  senha, mudanças de usuário e papel, clientes, entregas, status,
  entregador, ocorrências, arquivos, configurações e exportações.
- A tela de auditoria (admin) destaca os eventos de segurança.
- Os logs da aplicação levam `request_id` em cada linha.

### A10 — SSRF

- O backend não faz requisições a URLs fornecidas pelo usuário. A consulta de
  CEP sai do navegador, direto para o ViaCEP.

## 3. Achados desta revisão (todos corrigidos)

| # | Achado | Risco | Correção |
|---|---|---|---|
| 1 | O marcador do mapa (`divIcon` do Leaflet) montava HTML com as iniciais do nome do entregador sem escapar | XSS de baixo impacto (2 caracteres), mas é falha de classe grave | `escapeHtml` + teste |
| 2 | Após "encerrar sessões", o access token continuava válido por até 15 minutos | Celular roubado continuaria com acesso por alguns minutos | `users.sessions_revoked_at`: tokens emitidos antes são recusados |
| 3 | `iat` do JWT com resolução de segundo: uma revogação no mesmo segundo da emissão não invalidava o token | Janela de 1 s | `iat` com fração de segundo (permitido pela RFC 7519) |
| 4 | Ocorrência com foto inválida chegava a mudar o status antes de falhar | Inconsistência caso a sessão não fosse descartada | A foto é validada antes de qualquer mudança; a sessão de teste faz rollback em erro, como a real |

## 4. Riscos aceitos (conscientes)

| Risco | Por que aceito | Mitigação |
|---|---|---|
| E-mail/telefone são únicos no sistema inteiro: ao cadastrar, o admin descobre que um contato já existe em outra empresa | O login não pede a empresa (mais simples para o usuário) | Só admins autenticados criam usuários; a mensagem não diz em qual empresa |
| Rate limit em memória, por processo | Sem Redis no MVP | O Nginx aplica limite global por IP (fase 10) |
| GPS para quando o entregador abre o Maps | Limitação do navegador (ADR-08) | O mapa mostra "sem sinal recente"; o caminho futuro é o Capacitor |
| O operador finaliza entrega sem comprovante | Exceções reais (ex.: celular do entregador sem bateria) | Ação auditada com autor e horário |
| Auditoria guardada sem prazo | Volume pequeno; valor investigativo alto | Expurgo só com o usuário dono do schema, fora da aplicação |

## 5. Produção (fase 10)

As pendências levantadas nesta revisão viraram configuração versionada:
`docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`,
`frontend/nginx.conf` e [`deploy/`](../deploy/). Aplicar no servidor segue o
runbook ([deploy/README.md](../deploy/README.md)), que termina com um
checklist. O job `docker` do CI sobe essa stack e verifica parte disso a cada
push.

- [x] **HTTPS**: o Traefik do servidor emite e renova os certificados (Let's
  Encrypt) e redireciona HTTP para HTTPS.
- [x] **CSP no Nginx** da tela: `default-src 'self'`; `script-src 'self'`;
  `style-src 'self'`, sem `'unsafe-inline'`, porque o Leaflet aplica estilos via
  CSSOM e o frontend não usa atributos `style` em HTML cru;
  `img-src 'self' data: blob: <provedor de tiles>`;
  `connect-src 'self' https://viacep.com.br`; `frame-ancestors 'none'`;
  `base-uri 'none'`; `form-action 'self'`; `object-src 'none'`.
- [x] **HSTS**, `Permissions-Policy` (geolocalização e câmera só da própria
  origem), `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy`,
  repetidos nos `location` que definem headers próprios.
- [x] **Nginx**: `limit_req` em `/api/v1/auth/` (10/min por IP) e no restante
  da API, `client_max_body_size 10m`, `/api/docs` bloqueado, `server_tokens off`,
  arquivos ocultos negados e IP real aceito só das faixas privadas (Traefik).
- [x] **Exposição**: nenhuma porta publicada. O banco fica numa rede
  `internal` sem saída para a internet.
- [x] **Contêineres** sem root, com disco somente leitura, `cap_drop: ALL`,
  `no-new-privileges`, limites de memória e logs com limite de tamanho.
- [x] **PostgreSQL**: a API recebe apenas `despacha_app`. A credencial do dono
  do schema só existe no contêiner `migrate`, que roda as migrations e
  termina (verificado no CI).
- [x] **Build**: `.dockerignore` mantém `.env` fora das imagens, e
  `npm ci --ignore-scripts` impede que dependências executem código.
- [x] **Backups** do banco **e** dos uploads, cifrados com `age` para duas
  chaves (a do dono fica offline), com cópia externa opcional via `rclone` e
  **teste automático de restauração** mensal num PostgreSQL temporário sem
  rede.
- [x] **Timers** diários: `purge-locations` e `purge-sessions`.
- [x] **CI** (GitHub Actions): lint (inclui `ruff` S), testes, `pip-audit`,
  `npm audit` e teste de ponta a ponta da stack de produção.
  `permissions: contents: read` e nenhuma senha versionada.
- [x] `APP_ENV=production` fixo no compose; a API recusa subir com
  `DEV_SEED_PASSWORD`.

### Riscos aceitos na produção

| Risco | Por que aceito | Mitigação |
|---|---|---|
| Servidor compartilhado com outros sistemas | Custo; padrão já adotado no servidor | Redes próprias, nenhuma porta publicada, contêineres sem root; o socket do Docker só é acessível ao root e ao Traefik |
| A chave privada de backup do servidor fica no servidor | Necessária para o teste automático de restauração | Quem tem root já acessa o banco ao vivo; a cifra protege a cópia externa. A chave do dono fica offline |
| Tiles do OpenStreetMap no início | Volume pequeno no MVP | Trocar por provedor comercial é só configuração (`MAP_TILE_*` no `.env`) |
| Actions do CI e imagens base referenciadas por tag, não por digest | Simplicidade; o CI não tem segredos nem permissão de escrita | Fixar por SHA/digest (com Dependabot) é o próximo endurecimento |
| Migrations rodam antes da troca da API | Deploy sem janela de manutenção | Regra *expand → contract*, documentada no runbook |
