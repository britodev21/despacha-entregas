import { useEffect } from "react";

/**
 * Animação de entrada ao rolar: elementos com `data-reveal` dentro do
 * contêiner aparecem suavemente quando entram na tela.
 *
 * Seguro por padrão: sem JavaScript, sem IntersectionObserver ou com
 * "reduzir movimento" ligado no sistema, nada fica escondido — o conteúdo
 * nunca depende da animação para ser visto.
 */
export function useReveal(containerRef) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    const items = [...root.querySelectorAll("[data-reveal]")];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.dataset.reveal = "shown";
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    for (const item of items) {
      const box = item.getBoundingClientRect();
      // Já visível ao carregar: não esconde (evita "piscar" o topo da página).
      if (box.top < window.innerHeight) continue;
      item.dataset.reveal = "pending";
      observer.observe(item);
    }
    return () => observer.disconnect();
  }, [containerRef]);
}
