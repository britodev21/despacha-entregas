import axios from "axios";

/**
 * Sessão do usuário no navegador (ver ADR-04).
 *
 * - Access token: SOMENTE em memória (esta variável). Não vai para
 *   localStorage, onde qualquer script injetado (XSS) poderia lê-lo.
 *   Recarregou a página? Pedimos um novo com o refresh token.
 * - Refresh token: cookie HttpOnly. O JavaScript nunca o vê; o navegador
 *   envia sozinho para /api/v1/auth/*.
 */

let accessToken = null;
let refreshInFlight = null;
const expiredListeners = new Set();

// Cliente SEM interceptors, só para rotas de autenticação (evita loop:
// um 401 no refresh não pode disparar outro refresh).
export const authApi = axios.create({ baseURL: "/api/v1/auth", timeout: 15000 });

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
}

/** Inscreve-se para saber quando a sessão terminou (expirada ou logout em outra aba). */
export function onSessionEnded(listener) {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export function endSession({ broadcast = false } = {}) {
  accessToken = null;
  if (broadcast) channel?.postMessage("logout");
  expiredListeners.forEach((listener) => listener());
}

/**
 * Renova a sessão. Garante UMA renovação por vez:
 * - na mesma aba: chamadas simultâneas compartilham a mesma Promise;
 * - entre abas: Web Locks API serializa as renovações.
 *
 * Por que isso importa: o servidor faz rotação com detecção de reuso.
 * Duas renovações em paralelo com o mesmo cookie pareceriam roubo de token
 * e derrubariam a sessão.
 */
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = withCrossTabLock(async () => {
      const { data } = await authApi.post("/refresh");
      accessToken = data.access_token;
      return data;
    }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function withCrossTabLock(task) {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request("despacha:refresh", task);
  }
  return task();
}

// Logout em uma aba encerra a sessão nas outras imediatamente.
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("despacha:auth") : null;
channel?.addEventListener("message", (event) => {
  if (event.data === "logout") endSession();
});
