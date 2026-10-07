import { LayoutDashboard } from "lucide-react";

import { useAuth } from "@/auth/AuthContext";
import { Card } from "@/components/ui/Card/Card";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";

/** Painel da operação. Os indicadores reais chegam com as entregas (fase 8). */
export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} description="Visão geral da operação de hoje." />
      <Card>
        <EmptyState
          icon={LayoutDashboard}
          title="Os indicadores do dia aparecem aqui"
          description="Assim que as entregas começarem a ser cadastradas, você verá pendentes, em rota, entregues e o que precisa de atenção."
        />
      </Card>
    </>
  );
}
