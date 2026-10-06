import { TriangleAlert } from "lucide-react";
import { useRouteError } from "react-router";

import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";

import styles from "./CenteredPage.module.css";

/** Exibida quando uma tela quebra. Detalhes técnicos só no console, em dev. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);

  return (
    <main className={styles.centered}>
      <EmptyState
        icon={TriangleAlert}
        tone="danger"
        title="Algo deu errado"
        description="Não foi possível exibir esta tela. Recarregue a página; se o problema continuar, fale com o suporte."
        actions={<Button onClick={() => window.location.reload()}>Recarregar página</Button>}
      />
    </main>
  );
}
