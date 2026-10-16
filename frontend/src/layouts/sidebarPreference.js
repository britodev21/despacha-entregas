import { useCallback, useState } from "react";

const KEY = "despacha:sidebar";
const NARROW_DESKTOP = "(max-width: 79.99rem)"; // 1024-1279px: recolhida por padrão

/**
 * Estado inicial da sidebar. A escolha salva vence; sem escolha, começa
 * recolhida em telas de notebook pequeno (sobra espaço para quadro e mapa)
 * e aberta nas maiores.
 */
export function initialCollapsed(stored, isNarrowDesktop) {
  if (stored === "collapsed") return true;
  if (stored === "expanded") return false;
  return Boolean(isNarrowDesktop);
}

function readStored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // modo privado / armazenamento bloqueado
  }
}

/** Sidebar recolhida ou aberta, lembrada por navegador (só conveniência visual). */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() =>
    initialCollapsed(readStored(), window.matchMedia?.(NARROW_DESKTOP).matches),
  );

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(KEY, next ? "collapsed" : "expanded");
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}
