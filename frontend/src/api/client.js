import axios from "axios";

/**
 * Cliente HTTP único da aplicação.
 *
 * baseURL relativa ("/api/v1"): em dev o Vite encaminha para o FastAPI (proxy);
 * em produção o Nginx faz o mesmo. Frontend e API ficam na MESMA origem,
 * então não há CORS e o cookie do refresh token (fase 2) funciona com
 * SameSite=Strict.
 */
export const api = axios.create({
  baseURL: "/api/v1",
  timeout: 15000,
});

const FALLBACK_MESSAGES = {
  network: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  timeout: "O servidor demorou para responder. Tente novamente.",
  unavailable: "Servidor indisponível no momento. Tente novamente em instantes.",
  unknown: "Algo deu errado. Tente novamente.",
};

/**
 * Converte qualquer erro do Axios num formato único:
 * { status, code, message, details, requestId }
 *
 * O backend sempre responde erros como {"error": {code, message, ...}}.
 */
export function toApiError(error) {
  if (error?.response) {
    const { status, data } = error.response;
    const body = data?.error ?? {};
    // 5xx sem o corpo padrão = a API nem respondeu (proxy/Nginx devolveu 502/504).
    const fallback = status >= 500 ? FALLBACK_MESSAGES.unavailable : FALLBACK_MESSAGES.unknown;
    return {
      status,
      code: body.code ?? "UNKNOWN",
      message: body.message ?? fallback,
      details: body.details ?? [],
      requestId: body.request_id ?? null,
    };
  }
  const code = error?.code === "ECONNABORTED" ? "timeout" : error?.request ? "network" : "unknown";
  return {
    status: 0,
    code: code.toUpperCase(),
    message: FALLBACK_MESSAGES[code],
    details: [],
    requestId: null,
  };
}
