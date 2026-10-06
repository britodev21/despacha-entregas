import { CircleCheck, CircleX, Database, Plus, RefreshCw, Server } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { ThemeToggle } from "@/components/ui/ThemeToggle/ThemeToggle";
import { DELIVERY_STATUS } from "@/features/deliveries/deliveryStatus";

import styles from "./SystemStatusPage.module.css";
import { useHealth } from "./useHealth";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium" });

function CheckRow({ icon: Icon, label, state }) {
  const view = {
    loading: { tone: "neutral", text: "Verificando…", badgeIcon: <Spinner size="sm" label="" /> },
    ok: { tone: "success", text: "Operacional", badgeIcon: <CircleCheck aria-hidden="true" /> },
    down: { tone: "danger", text: "Indisponível", badgeIcon: <CircleX aria-hidden="true" /> },
    unknown: { tone: "neutral", text: "Sem resposta", badgeIcon: null },
  }[state];

  return (
    <li className={styles.checkRow}>
      <span className={styles.checkLabel}>
        <Icon aria-hidden="true" className={styles.checkIcon} />
        {label}
      </span>
      <Badge tone={view.tone} icon={view.badgeIcon}>
        {view.text}
      </Badge>
    </li>
  );
}

function SystemStatusCard() {
  const { status, database, checkedAt, error, retry } = useHealth();
  const loading = status === "loading";

  const apiState = loading ? "loading" : status === "offline" ? "down" : "ok";
  const dbState = loading
    ? "loading"
    : database === "ok"
      ? "ok"
      : database === "unavailable"
        ? "down"
        : "unknown";

  return (
    <Card
      title="Status do sistema"
      description="Verificação da API e do banco de dados."
      actions={
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<RefreshCw aria-hidden="true" />}
          loading={loading}
          onClick={retry}
        >
          Verificar
        </Button>
      }
    >
      <ul role="list" className={styles.checks} aria-live="polite">
        <CheckRow icon={Server} label="API" state={apiState} />
        <CheckRow icon={Database} label="Banco de dados" state={dbState} />
      </ul>

      {error && (
        <p role="alert" className={styles.error}>
          {error.message}
        </p>
      )}

      {checkedAt && (
        <p className={styles.meta}>
          Última verificação:{" "}
          <time dateTime={checkedAt.toISOString()}>{timeFormatter.format(checkedAt)}</time>
        </p>
      )}
    </Card>
  );
}

function DesignSystemCard() {
  const [saving, setSaving] = useState(false);

  const simulateSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1500);
  };

  return (
    <Card title="Design system" description="Tokens e componentes base, nos dois temas.">
      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Botões</h3>
        <div className={styles.row}>
          <Button iconLeft={<Plus aria-hidden="true" />} loading={saving} onClick={simulateSave}>
            Nova entrega
          </Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Discreto</Button>
          <Button variant="danger">Cancelar entrega</Button>
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Status de entrega</h3>
        <div className={styles.row}>
          {Object.entries(DELIVERY_STATUS).map(([key, { label, tone, Icon }]) => (
            <Badge key={key} tone={tone} icon={<Icon aria-hidden="true" />}>
              {label}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Página temporária da Fase 1: confirma que frontend, API e banco
 * conversam, e exibe o design system. Será substituída pelo login na Fase 2.
 */
export function SystemStatusPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <Badge tone="brand">Fase 1 · Fundação</Badge>
          <h1 className={styles.title}>Gestão de entregas simples e eficiente.</h1>
          <p className={styles.lead}>
            Base do projeto no ar. Esta página é temporária e dará lugar ao login na próxima fase.
          </p>
        </section>

        <div className={styles.grid}>
          <SystemStatusCard />
          <DesignSystemCard />
        </div>
      </main>
    </div>
  );
}
