-- ============================================================
-- DESPACHA — criação de usuários e banco (idempotente)
--
-- Executar como superusuário do PostgreSQL, uma vez por banco:
--
--   psql -U postgres \
--        -v owner_password='<SENHA_OWNER>' \
--        -v app_password='<SENHA_APP>' \
--        -v db_name='despacha' \
--        -f scripts/setup_db.sql
--
-- Dois usuários (princípio do menor privilégio):
--   despacha_owner → dono do schema. Usado SOMENTE pelas migrations.
--   despacha_app   → usado pela API. Apenas SELECT/INSERT/UPDATE/DELETE.
--                    Não cria, altera nem apaga tabelas.
--
-- Nunca coloque senhas reais neste arquivo.
-- ============================================================

\set ON_ERROR_STOP on

-- Usuários -----------------------------------------------------
SELECT format('CREATE ROLE despacha_owner LOGIN PASSWORD %L', :'owner_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'despacha_owner') \gexec

SELECT format('CREATE ROLE despacha_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'despacha_app') \gexec

-- Banco ---------------------------------------------------------
SELECT format('CREATE DATABASE %I OWNER despacha_owner ENCODING ''UTF8''', :'db_name')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db_name') \gexec

\connect :db_name

-- Ninguém além dos nossos usuários conecta neste banco.
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"db_name" TO despacha_app;

-- Só o owner cria objetos no schema public.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO despacha_app;

-- Toda tabela/sequence que o owner criar no futuro (via migration)
-- já nasce com permissão de DML para a aplicação.
-- Exceções (ex.: audit_logs append-only) são tratadas na própria migration.
ALTER DEFAULT PRIVILEGES FOR ROLE despacha_owner
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO despacha_app;
ALTER DEFAULT PRIVILEGES FOR ROLE despacha_owner
    GRANT USAGE, SELECT ON SEQUENCES TO despacha_app;
