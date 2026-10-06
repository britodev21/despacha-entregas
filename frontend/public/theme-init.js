/*
 * Aplica o tema ANTES do React carregar, evitando o "flash" de tema errado.
 * É um arquivo separado (não script inline) para funcionar com uma
 * Content-Security-Policy restritiva (script-src 'self').
 */
(function () {
  var preference = null;
  try {
    preference = localStorage.getItem("despacha:theme");
  } catch {
    /* localStorage indisponível (modo privado, bloqueado): usa o sistema */
  }
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var dark = preference === "dark" || (preference !== "light" && prefersDark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
