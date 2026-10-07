import axios from "axios";
import { useCallback, useEffect, useState } from "react";

import { api, toApiError } from "@/api/client";

/**
 * Consulta GET /health.
 * status: "loading" | "ok" | "degraded" (API no ar, banco fora) | "offline" (API fora)
 */
export function useHealth() {
  const [state, setState] = useState({
    status: "loading",
    database: null,
    checkedAt: null,
    error: null,
  });

  const check = useCallback(async (signal) => {
    try {
      const { data } = await api.get("/health", { signal });
      setState({
        status: data.status,
        database: data.database,
        checkedAt: new Date(),
        error: null,
      });
    } catch (error) {
      if (axios.isCancel(error)) return;
      // 503 traz o corpo do health check: a API respondeu, o banco não.
      if (error.response?.status === 503) {
        setState({
          status: "degraded",
          database: "unavailable",
          checkedAt: new Date(),
          error: null,
        });
        return;
      }
      setState({
        status: "offline",
        database: null,
        checkedAt: new Date(),
        error: toApiError(error),
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // O setState em check() só ocorre após a resposta da rede (assíncrono),
    // não durante o effect: sincroniza com um sistema externo (a API).
    // oxlint-disable-next-line react/set-state-in-effect
    check(controller.signal);
    // Cancela a requisição se o componente sair da tela antes da resposta.
    return () => controller.abort();
  }, [check]);

  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }));
    check();
  }, [check]);

  return { ...state, retry };
}
