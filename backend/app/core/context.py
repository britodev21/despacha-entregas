"""Dados da requisição atual, acessíveis de qualquer camada.

ContextVar guarda um valor por requisição, mesmo com várias requisições
simultâneas. Assim a auditoria e os logs sabem o request_id, o IP e o
navegador sem precisarmos passar o objeto Request por todas as funções.

Os valores são definidos pelo RequestContextMiddleware.
"""

from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
client_ip_var: ContextVar[str | None] = ContextVar("client_ip", default=None)
user_agent_var: ContextVar[str | None] = ContextVar("user_agent", default=None)
