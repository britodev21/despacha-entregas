import axios from "axios";
import { useCallback, useEffect, useState } from "react";

import { toApiError } from "@/api/client";

/**
 * Busca dados da API e expõe os três estados que toda tela precisa:
 * carregando, erro e dados. Sem cache — simplicidade primeiro.
 *
 *   const { data, error, loading, reload } = useQuery(
 *     (signal) => api.get("/users", { params, signal }).then((r) => r.data),
 *     [params.search],
 *   );
 *
 * Requisições antigas são canceladas quando os parâmetros mudam: a resposta
 * de uma busca velha nunca sobrescreve a de uma busca nova.
 */
export function useQuery(fetcher, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // oxlint-disable-next-line react/set-state-in-effect -- marca "carregando" ao trocar parâmetros
    setState((current) => ({ ...current, loading: true, error: null }));
    fetcher(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (axios.isCancel(error)) return;
        setState((current) => ({ ...current, error: toApiError(error), loading: false }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps definidas por quem chama
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
