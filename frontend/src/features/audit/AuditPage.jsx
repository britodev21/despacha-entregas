import { ChevronLeft, ChevronRight, ScrollText, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { api } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { DataTable } from "@/components/ui/DataTable/DataTable";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";
import { Select } from "@/components/ui/Select/Select";
import { useNow } from "@/lib/usePolling";
import { useQuery } from "@/lib/useQuery";

import { AUDIT_ACTIONS, AUDIT_CATEGORIES, describeDetails, SECURITY_ACTIONS } from "./auditLabels";
import styles from "./AuditPage.module.css";

const PAGE_SIZE = 50;
const PERIODS = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });

function isoDate(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date - offset).toISOString().slice(0, 10);
}

function resourceLink(log) {
  if (!log.resource_id) return null;
  if (log.resource_type === "delivery") return `/entregas?entrega=${log.resource_id}`;
  if (log.resource_type === "client") return `/clientes/${log.resource_id}`;
  return null;
}

/**
 * Auditoria (somente administrador). Somente leitura: ninguém, nem o admin,
 * altera ou apaga registros — o próprio banco impede (ADR-13).
 */
export function AuditPage() {
  const [period, setPeriod] = useState("7");
  const [category, setCategory] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(0);

  const now = useNow(60_000); // "hoje" estável entre renderizações
  const start = new Date(now);
  start.setDate(start.getDate() - (Number(period) - 1));
  const params = {
    date_from: isoDate(start),
    date_to: isoDate(now),
    category: category || undefined,
    user_id: userId || undefined,
  };

  const { data, error, loading } = useQuery(
    (signal) =>
      api
        .get("/audit", {
          signal,
          params: { ...params, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        })
        .then((r) => r.data),
    [JSON.stringify(params), page],
  );
  const { data: users } = useQuery(
    (signal) => api.get("/users", { signal, params: { limit: 100 } }).then((r) => r.data.items),
    [],
  );

  const change = (setter) => (event) => {
    setter(event.target.value);
    setPage(0);
  };

  const columns = [
    {
      key: "when",
      header: "Quando",
      render: (log) => (
        <time dateTime={log.created_at} className="tabular">
          {dateTime.format(new Date(log.created_at))}
        </time>
      ),
    },
    {
      key: "action",
      header: "Ação",
      primary: true,
      render: (log) => {
        const security = SECURITY_ACTIONS.has(log.action);
        const link = resourceLink(log);
        const summary = describeDetails(log);
        return (
          <div className={styles.action}>
            <span className={styles.actionLabel}>
              {security && (
                <Badge tone="danger" icon={<ShieldAlert aria-hidden="true" />}>
                  Segurança
                </Badge>
              )}
              {AUDIT_ACTIONS[log.action] ?? log.action}
            </span>
            {(summary || link) && (
              <span className={styles.muted}>
                {summary}
                {summary && link && " · "}
                {link && <Link to={link}>ver registro</Link>}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "user",
      header: "Quem",
      render: (log) =>
        log.user?.name ?? <span className={styles.muted}>Sistema / não identificado</span>,
    },
    {
      key: "ip",
      header: "IP",
      render: (log) => <span className={styles.ip}>{log.ip ?? "—"}</span>,
    },
    {
      key: "details",
      header: "Detalhes",
      render: (log) =>
        Object.keys(log.details).length > 0 || log.user_agent ? (
          <details className={styles.details}>
            <summary>ver</summary>
            <pre>{JSON.stringify({ ...log.details, navegador: log.user_agent }, null, 2)}</pre>
          </details>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
  ];

  const total = data?.total ?? 0;
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Quem fez o quê e quando. Registros não podem ser alterados nem apagados."
      />

      <div className={styles.filters} role="search">
        <Select label="Período" options={PERIODS} value={period} onChange={change(setPeriod)} />
        <Select
          label="Categoria"
          options={AUDIT_CATEGORIES}
          value={category}
          onChange={change(setCategory)}
        />
        <Select
          label="Usuário"
          options={[
            { value: "", label: "Todos" },
            ...(users ?? []).map((u) => ({ value: u.id, label: u.name })),
          ]}
          value={userId}
          onChange={change(setUserId)}
        />
      </div>

      {error ? (
        <Alert tone="danger">{error.message}</Alert>
      ) : !loading && data?.items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nenhum registro no período"
          description="Ajuste os filtros."
        />
      ) : (
        <>
          <DataTable
            caption="Registros de auditoria"
            columns={columns}
            rows={data?.items ?? []}
            loading={loading && !data}
          />
          {data && (
            <nav className={styles.pagination} aria-label="Paginação">
              <span className={styles.muted} aria-live="polite">
                {first}–{last} de {total}
              </span>
              <div className={styles.pageButtons}>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<ChevronLeft aria-hidden="true" />}
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  iconRight={<ChevronRight aria-hidden="true" />}
                  disabled={last >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}
