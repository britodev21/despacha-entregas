# 🚚 DESPACHA

**Sistema de gestão de entregas para pequenos negócios.**

O **DESPACHA** é uma aplicação web desenvolvida para simplificar o gerenciamento de entregas de pequenos e médios negócios.

A proposta é permitir que o negócio consiga **cadastrar, distribuir, acompanhar e finalizar entregas** de forma simples e organizada.

## 🎯 Objetivo

O projeto foi criado com foco em operações de entrega próprias, atendendo negócios como:

* Pizzarias
* Lanchonetes
* Farmácias
* Mercados
* Açougues
* Floriculturas
* Confeitarias
* Pequenos comércios

O DESPACHA busca oferecer uma experiência simples para o usuário final, mantendo uma arquitetura segura e preparada para evolução.

## 🛠️ Stack

### Frontend

* React + Vite (JavaScript)
* React Router
* Axios
* CSS puro com CSS Modules e design tokens (CSS Variables)

### Backend

* Python 3.14 (gerenciado com [uv](https://docs.astral.sh/uv/))
* FastAPI
* SQLAlchemy 2 + Alembic (migrations)
* Pydantic

### Banco de dados

* PostgreSQL 18

## 🏗️ Status

🚧 **Em desenvolvimento** — Fase 6 (Rastreamento) concluída.

O projeto está sendo desenvolvido inicialmente como um MVP, com evolução progressiva das funcionalidades.
As decisões de arquitetura e o plano de fases estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## 💻 Rodando localmente

Pré-requisitos: Python 3.14+, [uv](https://docs.astral.sh/uv/), Node.js 22+ e PostgreSQL 18.

### 1. Banco de dados

Crie os usuários e os bancos (desenvolvimento e testes) como superusuário do PostgreSQL.
Gere senhas fortes e **não** as versione:

```bash
cd backend
psql -U postgres -v owner_password='<SENHA_OWNER>' -v app_password='<SENHA_APP>'      -v db_name='despacha' -f scripts/setup_db.sql
psql -U postgres -v owner_password='<SENHA_OWNER>' -v app_password='<SENHA_APP>'      -v db_name='despacha_test' -f scripts/setup_db.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # preencha com as senhas criadas acima
uv sync                     # cria o ambiente e instala dependências
uv run alembic upgrade head # aplica as migrations
uv run pytest               # roda os testes
uv run uvicorn app.main:app --reload
```

API em `http://127.0.0.1:8000` — documentação interativa em `/api/docs` (desligada em produção).

Criar uma empresa e o primeiro administrador (não há cadastro público):

```bash
uv run python -m app.cli create-company --name "Minha Empresa"
uv run python -m app.cli create-user --company-id <ID_DA_EMPRESA>     --name "Seu Nome" --email voce@exemplo.com --role ADMIN   # a senha é pedida no terminal
```

Ou, só em desenvolvimento, dados de demonstração (admin, operador e entregador,
com a senha definida em `DEV_SEED_PASSWORD` no `.env`):

```bash
uv run python -m app.cli seed-dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
npm test          # testes automatizados (Vitest)
```

App em `http://127.0.0.1:5173`. O Vite encaminha `/api` para o backend (mesma origem, sem CORS).

## 🔐 Foco

Desde o início, o projeto considera aspectos como:

* Autenticação
* Controle de acesso
* Validação de dados
* Segurança da API
* Auditoria
* Rastreamento de entregas
* Responsividade
* Experiência mobile para entregadores

## 📌 Escopo inicial

O MVP terá como foco:

* Usuários e permissões
* Clientes
* Endereços
* Entregas
* Distribuição para entregadores
* Acompanhamento de status
* Rastreamento de localização
* Ocorrências
* Comprovantes de entrega
* Dashboard
* Histórico
* Auditoria

## 📄 Licença

Projeto em desenvolvimento.
