import { DELIVERY_STATUS } from "@/features/deliveries/deliveryStatus";
import { ROLE_LABELS } from "@/auth/permissions";

/** Texto em português de cada ação registrada pelo backend. */
export const AUDIT_ACTIONS = {
  "auth.login_succeeded": "Entrou no sistema",
  "auth.login_failed": "Falha de login",
  "auth.login_blocked": "Tentativa em conta bloqueada",
  "auth.account_locked": "Conta bloqueada por tentativas",
  "auth.logout": "Saiu do sistema",
  "auth.logout_all": "Saiu de todos os dispositivos",
  "auth.refresh_reuse_detected": "Possível roubo de sessão detectado",
  "auth.password_changed": "Alterou a própria senha",
  "user.created": "Criou usuário",
  "user.updated": "Editou usuário",
  "user.role_changed": "Alterou o perfil de um usuário",
  "user.deactivated": "Desativou usuário",
  "user.activated": "Reativou usuário",
  "user.password_reset": "Redefiniu a senha de um usuário",
  "user.sessions_revoked": "Encerrou as sessões de um usuário",
  "client.created": "Criou cliente",
  "client.updated": "Editou cliente",
  "client.archived": "Arquivou cliente",
  "client.activated": "Reativou cliente",
  "delivery.created": "Criou entrega",
  "delivery.updated": "Editou entrega",
  "delivery.status_changed": "Mudou o status de uma entrega",
  "delivery.deliverer_changed": "Trocou o entregador",
  "delivery.issue_reported": "Registrou ocorrência",
  "delivery.file_uploaded": "Anexou foto/assinatura",
  "deliveries.exported": "Exportou entregas (CSV)",
  "settings.updated": "Alterou as configurações",
};

/** Eventos de segurança: destacados na tela. */
export const SECURITY_ACTIONS = new Set([
  "auth.login_failed",
  "auth.login_blocked",
  "auth.account_locked",
  "auth.refresh_reuse_detected",
]);

export const AUDIT_CATEGORIES = [
  { value: "", label: "Todas as categorias" },
  { value: "auth", label: "Acesso (login, sessões)" },
  { value: "user", label: "Usuários" },
  { value: "client", label: "Clientes" },
  { value: "delivery", label: "Entregas" },
  { value: "deliveries", label: "Exportações" },
  { value: "settings", label: "Configurações" },
];

const FAILURE_REASONS = {
  unknown_identifier: "e-mail/telefone não cadastrado",
  wrong_password: "senha incorreta",
  account_locked: "conta bloqueada",
  inactive: "conta desativada",
};

const statusLabel = (value) => DELIVERY_STATUS[value]?.label ?? value;

/** Resumo legível dos detalhes do evento (o JSON completo fica disponível). */
export function describeDetails(log) {
  const d = log.details ?? {};
  switch (log.action) {
    case "auth.login_failed":
    case "auth.login_blocked":
      return FAILURE_REASONS[d.reason] ?? d.reason ?? "";
    case "auth.account_locked":
      return d.minutes ? `bloqueada por ${d.minutes} min` : "";
    case "delivery.status_changed":
      return `${statusLabel(d.from)} → ${statusLabel(d.to)}${d.reason ? ` · ${d.reason}` : ""}`;
    case "user.role_changed":
      return `${ROLE_LABELS[d.from] ?? d.from} → ${ROLE_LABELS[d.to] ?? d.to}`;
    case "user.created":
      return d.role ? `perfil ${ROLE_LABELS[d.role] ?? d.role}` : "";
    case "user.updated":
    case "client.updated":
    case "delivery.updated":
      return d.fields ? `campos: ${d.fields.join(", ")}` : (d.address ?? "");
    case "delivery.created":
      return d.number ? `entrega #${d.number}` : "";
    case "deliveries.exported":
      return `${d.rows ?? 0} linha(s)`;
    default:
      return "";
  }
}
