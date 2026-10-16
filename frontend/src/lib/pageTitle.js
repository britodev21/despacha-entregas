import { useEffect } from "react";
import { useMatches } from "react-router";

const APP_NAME = "DESPACHA";

/** "Operação" → "Operação · DESPACHA" (título da aba do navegador). */
export function formatDocumentTitle(title) {
  return title ? `${title} · ${APP_NAME}` : APP_NAME;
}

/**
 * Título da tela atual, vindo de `handle.title` da rota mais específica
 * (definido em app/router.jsx). Uma fonte só para o cabeçalho e para a aba.
 */
export function usePageTitle() {
  const matches = useMatches();
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const title = matches[index].handle?.title;
    if (title) return title;
  }
  return null;
}

/** Mantém o título da aba do navegador em dia com a rota. */
export function useDocumentTitle() {
  const title = usePageTitle();
  useEffect(() => {
    document.title = formatDocumentTitle(title);
  }, [title]);
  return title;
}
