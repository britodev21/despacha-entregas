import { Ban, Clock, Navigation, PackageCheck, TriangleAlert, UserCheck } from "lucide-react";

/**
 * Fonte única de verdade para exibir status de entrega.
 * Chaves = valores do enum no backend. Cada status tem texto, ícone e cor
 * (tom do Badge) — nunca só cor.
 */
export const DELIVERY_STATUS = {
  PENDING: { label: "Pendente", tone: "pending", Icon: Clock },
  ASSIGNED: { label: "Atribuída", tone: "assigned", Icon: UserCheck },
  IN_ROUTE: { label: "Em rota", tone: "inRoute", Icon: Navigation },
  DELIVERED: { label: "Entregue", tone: "delivered", Icon: PackageCheck },
  CANCELED: { label: "Cancelada", tone: "canceled", Icon: Ban },
  ISSUE: { label: "Ocorrência", tone: "issue", Icon: TriangleAlert },
};
