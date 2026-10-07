/**
 * Espelho das permissões do backend (app/core/permissions.py).
 * Usadas só para decidir o que MOSTRAR. Quem autoriza é o backend.
 */
export const PERMISSIONS = {
  USERS_MANAGE: "users:manage",
  AUDIT_READ: "audit:read",
  SETTINGS_MANAGE: "settings:manage",
  CLIENTS_MANAGE: "clients:manage",
  DELIVERIES_MANAGE: "deliveries:manage",
  TRACKING_READ: "tracking:read",
  DASHBOARD_READ: "dashboard:read",
  DELIVERIES_OWN: "deliveries:own",
  TRACKING_SEND: "tracking:send",
};

export const ROLE_LABELS = {
  ADMIN: "Administrador",
  OPERATOR: "Operador",
  DELIVERER: "Entregador",
};

/** Tela inicial de cada perfil. */
export function homePathFor(user) {
  return user?.role === "DELIVERER" ? "/entregador" : "/painel";
}

// Prefixo de rota → permissão exigida. Usado para decidir se o "voltar para
// onde estava" após o login faz sentido para o perfil que entrou.
const ROUTE_PERMISSIONS = [
  ["/entregador", PERMISSIONS.DELIVERIES_OWN],
  ["/usuarios", PERMISSIONS.USERS_MANAGE],
  ["/clientes", PERMISSIONS.CLIENTS_MANAGE],
  ["/painel", PERMISSIONS.DASHBOARD_READ],
];

export function canAccessPath(user, path) {
  const rule = ROUTE_PERMISSIONS.find(([prefix]) => path.startsWith(prefix));
  return !rule || (user?.permissions ?? []).includes(rule[1]);
}
