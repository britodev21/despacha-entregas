"""Máquina de estados da entrega (docs/ARQUITETURA.md, seção 6).

Única fonte de verdade sobre quais mudanças de status são permitidas.
Nenhuma parte do sistema altera `status` sem passar por aqui.

    PENDENTE → ATRIBUÍDA → EM ROTA → ENTREGUE
         ↘          ↘          ↘
                CANCELADA      OCORRÊNCIA → (retoma, redistribui, entrega ou cancela)
"""

from enum import StrEnum


class DeliveryStatus(StrEnum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_ROUTE = "IN_ROUTE"
    DELIVERED = "DELIVERED"
    CANCELED = "CANCELED"
    ISSUE = "ISSUE"


S = DeliveryStatus

TRANSITIONS: dict[DeliveryStatus, frozenset[DeliveryStatus]] = {
    S.PENDING: frozenset({S.ASSIGNED, S.CANCELED}),
    # ASSIGNED → ASSIGNED = troca de entregador
    S.ASSIGNED: frozenset({S.ASSIGNED, S.PENDING, S.IN_ROUTE, S.CANCELED}),
    S.IN_ROUTE: frozenset({S.DELIVERED, S.ISSUE, S.CANCELED}),
    S.ISSUE: frozenset({S.IN_ROUTE, S.PENDING, S.ASSIGNED, S.DELIVERED, S.CANCELED}),
    S.DELIVERED: frozenset(),
    S.CANCELED: frozenset(),
}

# O entregador só move as PRÓPRIAS entregas, e só nestes passos.
DELIVERER_TRANSITIONS: frozenset[tuple[DeliveryStatus, DeliveryStatus]] = frozenset(
    {
        (S.ASSIGNED, S.IN_ROUTE),
        (S.IN_ROUTE, S.DELIVERED),
        (S.IN_ROUTE, S.ISSUE),
        (S.ISSUE, S.IN_ROUTE),
    }
)

ACTIVE_STATUSES = frozenset({S.PENDING, S.ASSIGNED, S.IN_ROUTE, S.ISSUE})
FINAL_STATUSES = frozenset({S.DELIVERED, S.CANCELED})
# Endereço só pode mudar antes de o entregador sair.
ADDRESS_EDITABLE = frozenset({S.PENDING, S.ASSIGNED, S.ISSUE})


def can_transition(current: DeliveryStatus, target: DeliveryStatus) -> bool:
    return target in TRANSITIONS[current]


def deliverer_can_transition(current: DeliveryStatus, target: DeliveryStatus) -> bool:
    return (current, target) in DELIVERER_TRANSITIONS
