import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { api } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { usePolling, useNow } from "@/lib/usePolling";
import { useQuery } from "@/lib/useQuery";

import { DeliveryCard } from "./DeliveryCard";
import { DeliveryDrawer } from "./DeliveryDrawer";
import { DeliveryFormDialog } from "./DeliveryFormDialog";
import { DELIVERY_STATUS } from "./deliveryStatus";
import { isLate } from "./deliveryHelpers";
import styles from "./deliveries.module.css";

const COLUMNS = ["PENDING", "ASSIGNED", "IN_ROUTE", "ISSUE"];
const REFRESH_MS = 15000;

const COLUMN_TITLES = {
  PENDING: "Pendentes",
  ASSIGNED: "Atribuídas",
  IN_ROUTE: "Em rota",
  ISSUE: "Ocorrências",
};

const COLUMN_HINTS = {
  PENDING: "Aguardando entregador",
  ASSIGNED: "Com entregador, ainda não saíram",
  IN_ROUTE: "A caminho do cliente",
  ISSUE: "Precisam da sua atenção",
};

/**
 * Quadro de operação: o que está acontecendo AGORA, por etapa.
 * Atualiza sozinho a cada 15 s (polling) enquanto a aba está visível.
 */
export function OperationsPage() {
  const toast = useToast();
  const now = useNow();
  // Links diretos (ex.: do painel): /entregas?entrega=<id> abre o detalhe;
  // /entregas?nova=1 abre o formulário de nova entrega.
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState(() => params.get("entrega"));
  const [form, setForm] = useState(() => (params.get("nova") ? {} : null)); // { delivery? }
  useEffect(() => {
    if (params.has("entrega") || params.has("nova")) setParams({}, { replace: true });
  }, [params, setParams]);

  const { data, error, loading, reload } = useQuery(
    (signal) =>
      api
        .get("/deliveries", { signal, params: { status: COLUMNS, limit: 200 } })
        .then((r) => r.data),
    [],
  );
  usePolling(reload, REFRESH_MS);

  const byStatus = Object.fromEntries(COLUMNS.map((status) => [status, []]));
  for (const delivery of data?.items ?? []) byStatus[delivery.status]?.push(delivery);
  // Mais antigas primeiro: quem espera há mais tempo aparece no topo.
  for (const list of Object.values(byStatus)) list.reverse();
  const lateCount = (data?.items ?? []).filter((d) => isLate(d, now)).length;

  return (
    <>
      <PageHeader
        title="Operação"
        description={
          data
            ? `${data.total} ${data.total === 1 ? "entrega ativa" : "entregas ativas"}${lateCount ? ` · ${lateCount} atrasada${lateCount > 1 ? "s" : ""}` : ""}`
            : "Entregas em andamento agora."
        }
        actions={
          <>
            <Button
              variant="ghost"
              iconOnly
              aria-label="Atualizar agora"
              title="Atualizar agora"
              onClick={reload}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
            <Button iconLeft={<Plus aria-hidden="true" />} onClick={() => setForm({})}>
              Nova entrega
            </Button>
          </>
        }
      />

      {error && (
        <Alert tone="danger" title="Não foi possível atualizar o quadro.">
          {error.message} Tentaremos de novo automaticamente.
        </Alert>
      )}

      <div className={styles.board}>
        {COLUMNS.map((status) => {
          const view = DELIVERY_STATUS[status];
          const items = byStatus[status];
          return (
            <section key={status} className={styles.column} aria-labelledby={`col-${status}`}>
              <header className={styles.columnHeader} data-tone={view.tone}>
                <view.Icon aria-hidden="true" className={styles.columnIcon} />
                <h2 id={`col-${status}`} className={styles.columnTitle}>
                  {COLUMN_TITLES[status]}
                </h2>
                <span className={styles.columnCount}>{data ? items.length : "–"}</span>
              </header>
              <p className={styles.columnHint}>{COLUMN_HINTS[status]}</p>
              <div className={styles.columnBody}>
                {!data && loading ? (
                  <>
                    <Skeleton height="7rem" />
                    <Skeleton height="7rem" />
                  </>
                ) : items.length === 0 ? (
                  <p className={styles.columnEmpty}>Nenhuma</p>
                ) : (
                  items.map((delivery) => (
                    <DeliveryCard
                      key={delivery.id}
                      delivery={delivery}
                      now={now}
                      onOpen={setOpenId}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {openId && !form && (
        <DeliveryDrawer
          key={openId}
          deliveryId={openId}
          onClose={() => setOpenId(null)}
          onChanged={reload}
          onEdit={(delivery) => setForm({ delivery })}
        />
      )}
      {form && (
        <DeliveryFormDialog
          delivery={form.delivery}
          onClose={() => setForm(null)}
          onSaved={(delivery, message) => {
            setForm(null);
            toast.success(message);
            reload();
            setOpenId(delivery.id);
          }}
        />
      )}
    </>
  );
}
