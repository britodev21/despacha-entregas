"""RBAC: papéis fixos e o mapa papel → permissões (ver ADR-05).

As rotas verificam PERMISSÕES, nunca papéis diretamente:

    Depends(require_permission(Permission.USERS_MANAGE))

Assim, se um dia surgirem papéis customizáveis, só este mapa muda.
"""

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    DELIVERER = "DELIVERER"


class Permission(StrEnum):
    # Administração
    USERS_MANAGE = "users:manage"
    AUDIT_READ = "audit:read"
    SETTINGS_MANAGE = "settings:manage"
    # Operação
    CLIENTS_MANAGE = "clients:manage"
    DELIVERIES_MANAGE = "deliveries:manage"
    TRACKING_READ = "tracking:read"
    DASHBOARD_READ = "dashboard:read"
    # Entregador (sempre restrito às próprias entregas)
    DELIVERIES_OWN = "deliveries:own"
    TRACKING_SEND = "tracking:send"


_OPERATION = {
    Permission.CLIENTS_MANAGE,
    Permission.DELIVERIES_MANAGE,
    Permission.TRACKING_READ,
    Permission.DASHBOARD_READ,
}

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.ADMIN: frozenset(
        _OPERATION | {Permission.USERS_MANAGE, Permission.AUDIT_READ, Permission.SETTINGS_MANAGE}
    ),
    Role.OPERATOR: frozenset(_OPERATION),
    Role.DELIVERER: frozenset({Permission.DELIVERIES_OWN, Permission.TRACKING_SEND}),
}


def has_permission(role: Role, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role]
