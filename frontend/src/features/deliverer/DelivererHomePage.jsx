import { ChevronRight, Clock, MapPin, Package, RefreshCw, Wallet } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { api } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { collectInstructions, streetLine } from "@/features/deliveries/deliveryHelpers";
import { DELIVERY_STATUS } from "@/features/deliveries/deliveryStatus";
import { cx } from "@/lib/cx";
import { formatElapsed, formatMoment } from "@/lib/time";
import { usePolling, useNow } from "@/lib/usePolling";
import { useQuery } from "@/lib/useQuery";

import styles from "./deliverer.module.css";

const TABS = [
  { value: "active", label: "Minhas entregas" },
  { value: "history", label: "Histórico" },
];

function DeliveryRow({ delivery, now, highlight }) {
  const view = DELIVERY_STATUS[delivery.status];
  const collect = collectInstructions(delivery);
  return (
    <Link
      to={`/entregador/entregas/${delivery.id}`}
      className={cx(styles.row, highlight && styles.rowCurrent)}
    >
      <span className={styles.rowTop}>
        <Badge tone={view.tone} icon={<view.Icon aria-hidden="true" />}>
          {highlight ? "Entrega atual" : view.label}
        </Badge>
        <span className={styles.rowNumber}>#{delivery.number}</span>
      </span>
      <span className={styles.rowName}>{delivery.recipient_name}</span>
      <span className={styles.rowLine}>
        <MapPin aria-hidden="true" />
        <span>
          {streetLine(delivery)}
          <span className={styles.rowArea}> · {delivery.neighborhood}</span>
        </span>
      </span>
      {collect && delivery.status !== "DELIVERED" && delivery.status !== "CANCELED" && (
        <span className={styles.rowLine}>
          <Wallet aria-hidden="true" />
          {collect.text}
        </span>
      )}
      <span className={styles.rowLine}>
        <Clock aria-hidden="true" />
        {delivery.delivered_at || delivery.canceled_at
          ? `${delivery.status === "DELIVERED" ? "Entregue" : "Cancelada"} ${formatMoment(delivery.delivered_at ?? delivery.canceled_at, now)}`
          : `Criada há ${formatElapsed(delivery.created_at, now)}`}
      </span>
      <ChevronRight aria-hidden="true" className={styles.rowChevron} />
    </Link>
  );
}

/**
 * Tela inicial do entregador: o que fazer agora, sem menus.
 * A entrega em rota fica no topo, destacada.
 */
export function DelivererHomePage() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const scope = params.get("aba") === "historico" ? "history" : "active";

  const { data, error, loading, reload } = useQuery(
    (signal) => api.get("/me/deliveries", { signal, params: { scope } }).then((r) => r.data),
    [scope],
  );
  usePolling(reload, 20000);

  const items = data?.items ?? [];

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Visualização">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={scope === tab.value}
            className={cx(styles.tab, scope === tab.value && styles.tabActive)}
            onClick={() => setParams(tab.value === "history" ? { aba: "historico" } : {})}
          >
            {tab.label}
            {tab.value === "active" && scope === "active" && data ? ` (${data.total})` : ""}
          </button>
        ))}
        <Button
          variant="ghost"
          iconOnly
          aria-label="Atualizar"
          onClick={reload}
          className={styles.refresh}
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {!data && loading ? (
        <div className={styles.list}>
          <Skeleton height="8rem" />
          <Skeleton height="8rem" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            scope === "active" ? "Nenhuma entrega para você agora" : "Nenhuma entrega finalizada"
          }
          description={
            scope === "active"
              ? "Quando o operador atribuir uma entrega, ela aparece aqui. A lista atualiza sozinha."
              : "As entregas que você finalizar aparecem aqui."
          }
        />
      ) : (
        <div className={styles.list}>
          {items.map((delivery, index) => (
            <DeliveryRow
              key={delivery.id}
              delivery={delivery}
              now={now}
              highlight={scope === "active" && index === 0 && delivery.status === "IN_ROUTE"}
            />
          ))}
        </div>
      )}
    </>
  );
}
