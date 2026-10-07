import { KeyRound, Pencil, Plus, Search, UserRoundCheck, UserRoundX, Users } from "lucide-react";
import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert/Alert";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { DataTable } from "@/components/ui/DataTable/DataTable";
import { ConfirmDialog } from "@/components/ui/Dialog/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";
import { Select } from "@/components/ui/Select/Select";
import { TextField } from "@/components/ui/TextField/TextField";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { formatPhone } from "@/lib/phone";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useQuery } from "@/lib/useQuery";

import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { UserFormDialog } from "./UserFormDialog";
import styles from "./UsersPage.module.css";

const ROLE_FILTERS = [
  { value: "", label: "Todos os perfis" },
  { value: "ADMIN", label: "Administradores" },
  { value: "OPERATOR", label: "Operadores" },
  { value: "DELIVERER", label: "Entregadores" },
];

const STATUS_FILTERS = [
  { value: "true", label: "Ativos" },
  { value: "false", label: "Inativos" },
  { value: "", label: "Todos" },
];

const ROLE_TONES = { ADMIN: "brand", OPERATOR: "neutral", DELIVERER: "inRoute" };

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function statusOf(user) {
  if (!user.is_active) return { tone: "canceled", label: "Inativo" };
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return { tone: "warning", label: "Bloqueado" };
  }
  return { tone: "success", label: "Ativo" };
}

export function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("true");
  // Só busca quando a pessoa para de digitar (300 ms): uma requisição, não dez.
  const deferredSearch = useDebouncedValue(search.trim());

  const { data, error, loading, reload } = useQuery(
    (signal) =>
      api
        .get("/users", {
          signal,
          params: {
            search: deferredSearch || undefined,
            role: role || undefined,
            is_active: active || undefined,
          },
        })
        .then((response) => response.data),
    [deferredSearch, role, active],
  );

  // Qual diálogo está aberto: { type: "form" | "reset" | "toggle", user? }
  const [dialog, setDialog] = useState(null);
  const [toggling, setToggling] = useState(false);
  const close = () => setDialog(null);

  const handleSaved = (message) => {
    close();
    toast.success(message);
    reload();
  };

  async function toggleActive() {
    const target = dialog.user;
    setToggling(true);
    try {
      await api.patch(`/users/${target.id}`, { is_active: !target.is_active });
      handleSaved(
        target.is_active ? `${target.name} foi desativado(a).` : `${target.name} foi reativado(a).`,
      );
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setToggling(false);
    }
  }

  const columns = [
    {
      key: "name",
      header: "Nome",
      primary: true,
      render: (user) => (
        <div className={styles.identity}>
          <span className={styles.name}>
            {user.name}
            {user.id === me.id && <span className={styles.you}>você</span>}
          </span>
          <span className={styles.contact}>{user.email ?? formatPhone(user.phone)}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Perfil",
      render: (user) => <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (user) => {
        const status = statusOf(user);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: "last_login_at",
      header: "Último acesso",
      render: (user) =>
        user.last_login_at ? (
          <time dateTime={user.last_login_at}>
            {dateFormatter.format(new Date(user.last_login_at))}
          </time>
        ) : (
          <span className={styles.muted}>Nunca acessou</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: styles.actionsCell,
      render: (user) => {
        const isMe = user.id === me.id;
        return (
          <div className={styles.rowActions}>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Editar ${user.name}`}
              title="Editar"
              onClick={() => setDialog({ type: "form", user })}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Redefinir senha de ${user.name}`}
              title="Redefinir senha"
              onClick={() => setDialog({ type: "reset", user })}
            >
              <KeyRound aria-hidden="true" />
            </Button>
            {!isMe && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={user.is_active ? `Desativar ${user.name}` : `Reativar ${user.name}`}
                title={user.is_active ? "Desativar" : "Reativar"}
                onClick={() => setDialog({ type: "toggle", user })}
              >
                {user.is_active ? (
                  <UserRoundX aria-hidden="true" />
                ) : (
                  <UserRoundCheck aria-hidden="true" />
                )}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const filtered = Boolean(deferredSearch || role || active !== "true");

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Pessoas com acesso ao DESPACHA na sua empresa."
        actions={
          <Button
            iconLeft={<Plus aria-hidden="true" />}
            onClick={() => setDialog({ type: "form" })}
          >
            Novo usuário
          </Button>
        }
      />

      <div className={styles.toolbar} role="search">
        <TextField
          label="Buscar"
          type="search"
          placeholder="Nome, e-mail ou telefone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          endAdornment={<Search aria-hidden="true" className={styles.searchIcon} />}
          className={styles.search}
        />
        <Select
          label="Perfil"
          options={ROLE_FILTERS}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <Select
          label="Status"
          options={STATUS_FILTERS}
          value={active}
          onChange={(e) => setActive(e.target.value)}
        />
      </div>

      {error ? (
        <Alert tone="danger" title="Não foi possível carregar os usuários.">
          {error.message}{" "}
          <Button variant="secondary" size="sm" onClick={reload} className={styles.retry}>
            Tentar novamente
          </Button>
        </Alert>
      ) : !loading && data?.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "Nenhum usuário encontrado" : "Nenhum usuário ainda"}
          description={
            filtered
              ? "Tente outra busca ou ajuste os filtros."
              : "Cadastre operadores e entregadores para começar."
          }
        />
      ) : (
        <>
          <DataTable
            caption="Usuários da empresa"
            columns={columns}
            rows={data?.items ?? []}
            loading={loading && !data}
          />
          {data && (
            <p className={styles.count} aria-live="polite">
              {data.total === 1 ? "1 usuário" : `${data.total} usuários`}
            </p>
          )}
        </>
      )}

      {dialog?.type === "form" && (
        <UserFormDialog
          key={dialog.user?.id ?? "new"}
          open
          user={dialog.user}
          onClose={close}
          onSaved={(_, message) => handleSaved(message)}
        />
      )}
      {dialog?.type === "reset" && (
        <ResetPasswordDialog
          key={dialog.user.id}
          open
          user={dialog.user}
          onClose={close}
          onDone={handleSaved}
        />
      )}
      {dialog?.type === "toggle" && (
        <ConfirmDialog
          open
          tone={dialog.user.is_active ? "danger" : "primary"}
          title={dialog.user.is_active ? "Desativar usuário?" : "Reativar usuário?"}
          description={dialog.user.name}
          confirmLabel={dialog.user.is_active ? "Desativar usuário" : "Reativar usuário"}
          loading={toggling}
          onConfirm={toggleActive}
          onCancel={close}
        >
          <p className={styles.muted}>
            {dialog.user.is_active
              ? "A pessoa perde o acesso imediatamente e todas as sessões dela são encerradas. O histórico é mantido e você pode reativar depois."
              : "A pessoa volta a poder entrar com a senha atual."}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
