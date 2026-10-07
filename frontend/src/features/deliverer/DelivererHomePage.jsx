import { Package } from "lucide-react";

import { Card } from "@/components/ui/Card/Card";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";

/** Tela inicial do entregador. A lista real chega na fase 5. */
export function DelivererHomePage() {
  return (
    <>
      <PageHeader title="Minhas entregas" />
      <Card>
        <EmptyState
          icon={Package}
          title="Nenhuma entrega para você agora"
          description="Quando o operador atribuir uma entrega, ela aparece aqui."
        />
      </Card>
    </>
  );
}
