const KEY = "despacha:had-session";

/**
 * Marca (sem nenhum dado sensível) de que este navegador já teve sessão.
 * A página inicial usa para decidir, enquanto a sessão é verificada, entre
 * mostrar a apresentação na hora (visitante) ou um carregamento (cliente que
 * vai ser levado ao painel) — sem a apresentação "piscar" para quem já usa.
 */
export function hadSession() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberSession(active) {
  try {
    if (active) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // armazenamento indisponível (modo privado): só perde a otimização
  }
}
