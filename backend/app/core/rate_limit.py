"""Rate limit por IP com janela deslizante, em memória.

Limitação conhecida: cada processo do Uvicorn tem seu próprio contador.
Por isso, em produção, o Nginx aplica um segundo limite (global, por IP).
As duas camadas juntas: o Nginx barra volume, a aplicação barra abuso
direcionado mesmo se alguém acessar o Uvicorn por outro caminho.
"""

import math
import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import TooManyRequestsError


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str) -> int | None:
        """Registra uma tentativa. Retorna None se permitida, ou quantos
        segundos esperar se o limite estourou."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return max(1, math.ceil(hits[0] + self.window - now))
            hits.append(now)
            if len(self._hits) > 10_000:
                self._prune(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def _prune(self, now: float) -> None:
        # Evita crescer para sempre com IPs que nunca mais voltaram.
        expired = [
            key for key, hits in self._hits.items() if not hits or hits[-1] <= now - self.window
        ]
        for key in expired:
            del self._hits[key]


_settings = get_settings()
login_limiter = RateLimiter(limit=_settings.login_rate_limit_per_minute, window_seconds=60)
refresh_limiter = RateLimiter(limit=30, window_seconds=60)


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def limit_login(request: Request) -> None:
    if retry_after := login_limiter.hit(_client_key(request)):
        raise TooManyRequestsError(retry_after)


def limit_refresh(request: Request) -> None:
    if retry_after := refresh_limiter.hit(_client_key(request)):
        raise TooManyRequestsError(retry_after)
