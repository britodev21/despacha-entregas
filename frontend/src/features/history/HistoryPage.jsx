import { ChevronLeft, ChevronRight, Download, History, Search } from "lucide-react";
import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { DataTable } from "@/components/ui/DataTable/DataTable";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";
import { Select } from "@/components/ui/Select/Select";
import { TextField } from "@/components/ui/TextField/TextField";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { DeliveryDrawer } from "@/features/deliveries/DeliveryDrawer";
import { DeliveryFormDialog } from "@/features/deliveries/DeliveryFormDialog";
import { DELIVERY_STATUS } from "@/features/deliveries/deliveryStatus";
import { formatMoney } from "@/lib/money";
import { formatMoment } from "@/lib/time";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useQuery } from "@/lib/useQuery";

import styles from "./HistoryPage.module.css";

const PAGE_SIZE = 50;

const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "custom", label: "Personalizado" },
];

const STATUS_FILTERS = [
  { value: "", label: "Todos os status" },
  { value: "DELIVERED", label: "Entregues" },
  { value: "CANCELED", label: "Canceladas" },
  { value: "ACTIVE", label: "Em andamento" },
];
const ACTIVE = ["PENDING", "ASSIGNED", "IN_ROUTE", "ISSUE"];

/** Data local (AAAA-MM-DD) — o backend interpreta no fuso da empresa. */
function isoDate(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date - offset).toISOString().slice(0, 10);
}

function rangeFor(period, custom) {
  const today = new Date();
  if (period === "custom") return custom;
  if (period === "today") return { from: isoDate(today), to: isoDate(today) };
  const start = new Date(today);
  start.setDate(start.getDate() - (Number(period) - 1));
  return { from: isoDate(start), to: isoDate(today) };
}

export function HistoryPage() {
  const toast = useToast();
  const [period, setPeriod] = useState("today");
  const [custom, setCustom] = useState(() => ({
    from: isoDate(new Date()),
    to: isoDate(new Date()),
  }));
  const [status, setStatus] = useState("");
  const [delivererId, setDelivererId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [exporting, setExporting] = useState(false);
  const term = useDebouncedValue(search.trim());

  const range = rangeFor(period, custom);
  const params = {
    created_from: range.from || undefined,
    created_to: range.to || undefined,
    status: status === "ACTIVE" ? ACTIVE : status || undefined,
    deliverer_id: delivererId || undefined,
    search: term || undefined,
  };
  const filterKey = JSON.stringify(params);

  const { data, error, loading, reload } = useQuery(
    (signal) =>
      api
        .get("/deliveries", {
          signal,
          params: { ...params, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
        })
        .then((r) => r.data),
    [filterKey, page],
  );
  const { data: deliverers } = useQuery(
    (signal) => api.get("/deliverers", { signal }).then((r) => r.data),
    [],
  );
  const { data: report } = useQuery(
    (signal) =>
      api
        .get("/reports/deliverers", {
          signal,
          params: { date_from: range.from, date_to: range.to },
        })
        .then((r) => r.data),
    [range.from, range.to],
  );

  // Mudou um filtro: volta para a primeira página.
  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(0);
  };

  async function exportCsv() {
    setExporting(true);
    try {
      const response = await api.get("/deliveries/export.csv", { params, responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `despacha-entregas-${range.from}_${range.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setExporting(false);
    }
  }

  const columns = [
    {
      key: "number",
      header: "Nº",
      render: (d) => <span className={styles.number}>#{d.number}</span>,
    },
    {
      key: "recipient",
      header: "Destinatário",
      primary: true,
      render: (d) => (
        <button type="button" className={styles.rowLink} onClick={() => setOpenId(d.id)}>
          <span className={styles.strong}>{d.recipient_name}</span>
          <span className={styles.muted}>{d.neighborhood}</span>
        </button>
      ),
    },
    {
      key: "created_at",
      header: "Criada",
      render: (d) => <time dateTime={d.created_at}>{formatMoment(d.created_at)}</time>,
    },
    { key: "deliverer", header: "Entregador", render: (d) => d.deliverer?.name ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (d) => {
        const view = DELIVERY_STATUS[d.status];
        return (
          <Badge tone={view.tone} icon={<view.Icon aria-hidden="true" />}>
            {view.label}
          </Badge>
        );
      },
    },
    {
      key: "amount",
      header: "Valor",
      render: (d) => <span className="tabular">{formatMoney(d.order_amount) || "—"}</span>,
    },
    {
      key: "fee",
      header: "Taxa",
      render: (d) => <span className="tabular">{formatMoney(d.delivery_fee) || "—"}</span>,
    },
  ];

  const total = data?.total ?? 0;
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Histórico"
        description="Entregas anteriores, com filtros e resumo por entregador."
        actions={
          <Button
            variant="secondary"
            iconLeft={<Download aria-hidden="true" />}
            onClick={exportCsv}
            loading={exporting}
            disabled={!total}
          >
            Exportar CSV
          </Button>
        }
      />

      <div className={styles.filters} role="search">
        <Select
          label="Período"
          options={PERIODS}
          value={period}
          onChange={changeFilter(setPeriod)}
        />
        {period === "custom" && (
          <>
            <TextField
              label="De"
              type="date"
              value={custom.from}
              max={custom.to}
              onChange={(e) => {
                setCustom((c) => ({ ...c, from: e.target.value }));
                setPage(0);
              }}
            />
            <TextField
              label="Até"
              type="date"
              value={custom.to}
              min={custom.from}
              onChange={(e) => {
                setCustom((c) => ({ ...c, to: e.target.value }));
                setPage(0);
              }}
            />
          </>
        )}
        <Select
          label="Status"
          options={STATUS_FILTERS}
          value={status}
          onChange={changeFilter(setStatus)}
        />
        <Select
          label="Entregador"
          options={[
            { value: "", label: "Todos" },
            ...(deliverers ?? []).map((d) => ({ value: d.id, label: d.name })),
          ]}
          value={delivererId}
          onChange={changeFilter(setDelivererId)}
        />
        <TextField
          label="Buscar"
          type="search"
          placeholder="Nº, nome ou telefone"
          value={search}
          onChange={changeFilter(setSearch)}
          endAdornment={<Search aria-hidden="true" className={styles.searchIcon} />}
        />
      </div>

      {error ? (
        <Alert tone="danger" title="Não foi possível carregar o histórico.">
          {error.message}{" "}
          <Button variant="secondary" size="sm" onClick={reload}>
            Tentar novamente
          </Button>
        </Alert>
      ) : !loading && data?.items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhuma entrega encontrada"
          description="Ajuste o período ou os filtros."
        />
      ) : (
        <>
          <DataTable
            caption="Histórico de entregas"
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

      <Card
        title="Resumo por entregador"
        description="No período escolhido: entregues e taxas pela data de entrega; canceladas e ocorrências pela data em que aconteceram."
        className={styles.report}
      >
        {!report?.length ? (
          <p className={styles.muted}>Nenhuma entrega finalizada no período.</p>
        ) : (
          <div className={styles.reportWrap}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th scope="col">Entregador</th>
                  <th scope="col">Entregues</th>
                  <th scope="col">Canceladas</th>
                  <th scope="col">Ocorrências</th>
                  <th scope="col">Taxas</th>
                  <th scope="col">Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr key={row.deliverer_id}>
                    <th scope="row">{row.name}</th>
                    <td>{row.delivered}</td>
                    <td>{row.canceled}</td>
                    <td>{row.issues}</td>
                    <td>{formatMoney(row.fees_total)}</td>
                    <td>{row.avg_minutes != null ? `${row.avg_minutes} min` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {openId && !editing && (
        <DeliveryDrawer
          key={openId}
          deliveryId={openId}
          onClose={() => setOpenId(null)}
          onChanged={reload}
          onEdit={(delivery) => setEditing(delivery)}
        />
      )}
      {editing && (
        <DeliveryFormDialog
          delivery={editing}
          onClose={() => setEditing(null)}
          onSaved={(_, message) => {
            setEditing(null);
            toast.success(message);
            reload();
          }}
        />
      )}
    </>
  );
}
