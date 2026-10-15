# DESPACHA — Revisão de Segurança (Fase 9)

> Revisão feita ao fim da fase 9, antes da preparação para produção.
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

## 5. Pendências para a produção (fase 10)

- [ ] **CSP no Nginx** para o frontend: `default-src 'self'`; `img-src 'self' blob: data: <provedor de tiles>`; `connect-src 'self' https://viacep.com.br`; `script-src 'self'`; `style-src 'self' 'unsafe-inline'` (estilos dinâmicos do Leaflet); `frame-ancestors 'none'`.
- [ ] **HSTS**, `Permissions-Policy` (geolocalização e câmera só da própria origem) e `X-Content-Type-Options` também nas respostas estáticas.
- [ ] Nginx: `limit_req` nas rotas `/api/v1/auth/` e geral, `client_max_body_size` compatível com `MAX_UPLOAD_MB`.
- [ ] Uvicorn: `--proxy-headers --forwarded-allow-ips 127.0.0.1 --no-server-header`, escutando só em `127.0.0.1`.
- [ ] PostgreSQL só em `localhost`, com os dois usuários (owner/app) e senhas fortes.
- [ ] Firewall com só 22/80/443 abertas; SSH somente com chave e sem login de root.
- [ ] Backups do banco **e** da pasta de uploads, cifrados e fora do servidor, com **teste de restauração** documentado.
- [ ] Timers diários: `purge-locations` e `purge-sessions`.
- [ ] `APP_ENV=production` (desliga `/api/docs` e ativa as travas de configuração).
