import { useEffect, useRef, useState } from "react";

/**
 * Chama `callback` a cada `intervalMs` enquanto a aba está visível, e uma vez
 * ao voltar para a aba. Aba escondida = nenhuma requisição (economia de
 * bateria e de servidor). Ver ADR-08: polling no MVP em vez de WebSocket.
 */
export function usePolling(callback, intervalMs) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    let timer = null;
    const startTimer = () => {
      stopTimer();
      timer = setInterval(() => saved.current(), intervalMs);
    };
    const stopTimer = () => timer && clearInterval(timer);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        saved.current();
        startTimer();
      } else {
        stopTimer();
      }
    };

    if (document.visibilityState === "visible") startTimer();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}

/** Data/hora atual que se atualiza sozinha (para "há 5 min" não ficar parado). */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
