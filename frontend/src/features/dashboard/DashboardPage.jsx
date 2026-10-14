import {
  CircleCheck,
  Clock,
  Navigation,
  Package,
  PackageCheck,
  Plus,
  Timer,
  TriangleAlert,
  UserCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router";

import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert/Alert";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { StatTile } from "@/components/ui/StatTile/StatTile";
import { formatElapsed, formatMoment } from "@/lib/time";
import { usePolling, useNow } from "@/lib/usePolling";
import { useQuery } from "@/lib/useQuery";

import styles from "./DashboardPage.module.css";

const REASONS = {
  ISSUE: { tone: "issue", label: "Ocorrência", Icon: TriangleAlert },
  LATE: { tone: "warning", label: "Atrasada", Icon: Clock },
  WAITING: { tone: "pending", label: "Sem entregador", Icon: Clock },
};

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function AttentionList({ items, now }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="Tudo em dia"
        description="Nenhuma ocorrência, atraso ou entrega esperando entregador."
      />
    );
  }
  return (
    <ul role="list" className={styles.attention}>
      {items.map((item) => {
        const reason = REASONS[item.reason];
        const when =
          item.reason === "LATE"
            ? `previsão ${formatMoment(item.since, now)}`
            : `há ${formatElapsed(item.since, now)}`;
        return (
          <li key={item.delivery_id}>
            <Link to={`/entregas?entrega=${item.delivery_id}`} className={styles.attentionItem}>
              <Badge tone={reason.tone} icon={<reason.Icon aria-hidden="true" />}>
                {reason.label}
              </Badge>
              <span className={styles.attentionMain}>
                <span className={styles.attentionTitle}>
                  #{item.number} · {item.recipient_name}
                </span>
                <span className={styles.muted}>
                  {item.neighborhood}
                  {item.deliverer_name && ` · ${item.deliverer_name}`}
                </span>
              </span>
              <span className={styles.attentionWhen}>{when}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Painel: responde, nesta ordem, "o que está acontecendo?", "o que precisa
 * de atenção?" e "o que posso fazer agora?". Sem gráficos decorativos.
 */
export function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const now = useNow();
  const { data, error, loading, reload } = useQuery(
    (signal) => api.get("/dashboard/summary", { signal }).then((r) => r.data),
    [],
  );
  usePolling(reload, 30_000);

  const firstName = user.name.split(" ")[0];
  const canCreate = hasPermission(PERMISSIONS.DELIVERIES_MANAGE);

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description={`Operação de ${dateFormat.format(now)}.`}
        actions={
          canCreate && (
            <Button as={Link} to="/entregas?nova=1" iconLeft={<Plus aria-hidden="true" />}>
              Nova entrega
            </Button>
          )
        }
      />

      {error && (
        <Alert tone="danger" title="Não foi possível atualizar o painel.">
          {error.message}
        </Alert>
      )}

      {!data ? (
        loading && (
          <div className={styles.tiles}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} height="7.5rem" />
            ))}
          </div>
        )
      ) : (
        <>
          <section className={styles.tiles} aria-label="Indicadores de hoje">
            <StatTile
              label="Entregas hoje"
              value={data.created_today}
              icon={Package}
              delta={{
                value: data.created_today - data.created_yesterday_until_now,
                label: "vs. ontem até agora",
              }}
            />
            <StatTile
              label="Pendentes"
              value={data.pending}
              icon={Clock}
              tone="pending"
              hint="Aguardando entregador"
            />
            <StatTile
              label="Atribuídas"
              value={data.assigned}
              icon={UserCheck}
              tone="assigned"
              hint="Ainda não saíram"
            />
            <StatTile label="Em rota" value={data.in_route} icon={Navigation} tone="inRoute" />
            <StatTile
              label="Entregues hoje"
              value={data.delivered_today}
              icon={PackageCheck}
              tone="delivered"
            />
            <StatTile
              label="Ocorrências"
              value={data.issues}
              icon={TriangleAlert}
              tone="issue"
              emphasis={data.issues > 0}
              hint={data.issues > 0 ? "Precisam da sua atenção" : "Nenhuma agora"}
            />
            <StatTile label="Entregadores ativos" value={data.active_deliverers} icon={Users} />
            <StatTile
              label="Tempo médio hoje"
              value={
                data.avg_delivery_minutes_today != null
                  ? `${data.avg_delivery_minutes_today} min`
                  : "—"
              }
              icon={Timer}
              hint="Da criação até a entrega"
            />
          </section>

          <Card
            title="Precisa de atenção"
            description="Ocorrências, entregas atrasadas e pendentes esperando há mais de 15 minutos."
            actions={
              data.attention.length > 0 && <Badge tone="danger">{data.attention.length}</Badge>
            }
          >
            <AttentionList items={data.attention} now={now} />
          </Card>
        </>
      )}
    </>
  );
}
