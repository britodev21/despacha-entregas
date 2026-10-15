const KEY = "despacha:stale-chunk-reload";
const MIN_INTERVAL_MS = 10_000;

/**
 * Cada deploy troca os arquivos com hash no nome. Uma aba aberta antes do
 * deploy, ao abrir uma tela ainda não carregada, pede um arquivo que não existe
 * mais. O Vite avisa com o evento `vite:preloadError`: recarregamos a página
 * para pegar a versão nova. Só uma vez a cada 10 s, para nunca entrar em loop
 * se o problema for outro (ex.: sem internet).
 */
export function shouldReload(lastReloadAt, now) {
  return !lastReloadAt || now - lastReloadAt > MIN_INTERVAL_MS;
}

export function installStaleChunkReload(target = window, storage = sessionStorage) {
  target.addEventListener("vite:preloadError", (event) => {
    let last = 0;
    try {
      last = Number(storage.getItem(KEY)) || 0;
    } catch {
      // sessionStorage indisponível (modo privado): recarrega sem memória.
    }
    const now = Date.now();
    if (!shouldReload(last, now)) return; // deixa o erro aparecer na tela de erro
    event.preventDefault();
    try {
      storage.setItem(KEY, String(now));
    } catch {
      // idem
    }
    target.location.reload();
  });
}
