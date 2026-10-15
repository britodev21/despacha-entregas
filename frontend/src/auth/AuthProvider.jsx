import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/api/client";
import { authApi, endSession, onSessionEnded, refreshSession, setAccessToken } from "@/api/session";

import { AuthContext } from "./AuthContext";
import { rememberSession } from "./sessionHint";

/**
 * Estado de autenticação da aplicação.
 *
 * status: "loading"       → verificando se existe sessão (cookie de refresh)
 *         "authenticated" → user preenchido
 *         "anonymous"     → precisa fazer login
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", user: null });

  useEffect(() => {
    let active = true;

    // Ao abrir/recarregar: o access token sumiu da memória, mas o cookie de
    // refresh pode existir. Tentamos renovar; se falhar, é visitante.
    refreshSession()
      .then((data) => active && setState({ status: "authenticated", user: data.user }))
      .catch(() => active && setState({ status: "anonymous", user: null }));

    const unsubscribe = onSessionEnded(() => setState({ status: "anonymous", user: null }));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.status !== "loading") rememberSession(state.status === "authenticated");
  }, [state.status]);

  const login = useCallback(async (identifier, password) => {
    const { data } = await authApi.post("/login", { identifier, password });
    setAccessToken(data.access_token);
    setState({ status: "authenticated", user: data.user });
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.post("/logout");
    } finally {
      // Mesmo se a rede falhar, a sessão local acaba (e nas outras abas).
      endSession({ broadcast: true });
    }
  }, []);

  /** Encerra a sessão em TODOS os aparelhos (ex.: celular perdido). */
  const logoutAll = useCallback(async () => {
    try {
      await api.post("/auth/logout-all");
    } finally {
      endSession({ broadcast: true });
    }
  }, []);

  /** Atualiza token/usuário após operações que reemitem a sessão (ex.: troca de senha). */
  const applySession = useCallback((data) => {
    setAccessToken(data.access_token);
    setState({ status: "authenticated", user: data.user });
  }, []);

  const value = useMemo(() => {
    const permissions = new Set(state.user?.permissions ?? []);
    return {
      ...state,
      login,
      logout,
      logoutAll,
      applySession,
      hasPermission: (permission) => permissions.has(permission),
    };
  }, [state, login, logout, logoutAll, applySession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
