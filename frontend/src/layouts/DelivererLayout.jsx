import { Suspense } from "react";
import { Outlet } from "react-router";

import { Logo } from "@/components/brand/Logo";
import { PageLoader } from "@/components/ui/PageLoader/PageLoader";
import { useTracking } from "@/features/tracking/TrackingContext";
import { TrackingProvider } from "@/features/tracking/TrackingProvider";
import { cx } from "@/lib/cx";

import styles from "./DelivererLayout.module.css";
import { UserMenu } from "./UserMenu";

const TRACKING_PILL = {
  active: {
    tone: styles.pillActive,
    text: "Localização ativa",
    title: "Sua localização é compartilhada só enquanto há entrega em rota.",
  },
  denied: {
    tone: styles.pillWarning,
    text: "GPS bloqueado",
    title:
      "Permita a localização nas configurações do navegador para o operador acompanhar a rota.",
  },
  unsupported: {
    tone: styles.pillWarning,
    text: "Sem GPS",
    title: "Este navegador não oferece localização.",
  },
};

function TrackingPill() {
  const { status } = useTracking();
  const pill = TRACKING_PILL[status];
  if (!pill) return null;
  return (
    <span className={cx(styles.pill, pill.tone)} title={pill.title} role="status">
      <span className={styles.pillDot} aria-hidden="true" />
      {pill.text}
    </span>
  );
}

/**
 * Estrutura da área do entregador: pensada para celular, uma mão, na rua.
 * Sem menu lateral: tudo o que importa fica na própria tela.
 */
export function DelivererLayout() {
  return (
    <TrackingProvider>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Logo size="sm" showWordmark={false} />
          <TrackingPill />
          <div className={styles.actions}>
            {/* Tema dentro do menu da conta: no topo, junto do indicador de GPS,
                estourava a largura do celular. */}
            <UserMenu compact themeInMenu />
          </div>
        </header>
        <main className={styles.content}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </TrackingProvider>
  );
}
