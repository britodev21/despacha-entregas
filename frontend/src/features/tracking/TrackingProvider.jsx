import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/api/client";
import { usePolling } from "@/lib/usePolling";

import { shouldSend } from "./locationThrottle";
import { TrackingContext } from "./TrackingContext";

const CHECK_INTERVAL_MS = 30_000;

/**
 * Compartilha a localização do entregador SÓ durante a operação.
 *
 * 1. Pergunta ao servidor se há entrega em rota (GET /me/tracking).
 * 2. Se sim, liga o GPS (watchPosition) e envia com moderação (20 s / 50 m).
 * 3. Se o servidor responder tracking=false (entregou tudo), desliga o GPS.
 *
 * Limitação conhecida (ADR-08): o navegador suspende a página quando o
 * entregador abre o Google Maps; o envio pausa até ele voltar ao DESPACHA.
 *
 * status: "idle" (fora da operação) | "active" | "denied" | "unsupported"
 */
export function TrackingProvider({ children }) {
  const [shouldTrack, setShouldTrack] = useState(false);
  const [status, setStatus] = useState("idle");
  const lastSent = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/me/tracking");
      setShouldTrack(data.tracking);
    } catch {
      /* sem rede: mantém o estado atual e tenta de novo no próximo ciclo */
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- consulta ao servidor (sistema externo)
    refresh();
  }, [refresh]);
  usePolling(refresh, CHECK_INTERVAL_MS);

  useEffect(() => {
    if (!shouldTrack) {
      // oxlint-disable-next-line react/set-state-in-effect -- reflete o fim da operação
      setStatus("idle");
      return undefined;
    }
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      async ({ coords, timestamp }) => {
        setStatus("active");
        const point = { lat: coords.latitude, lng: coords.longitude };
        const now = Date.now();
        if (!shouldSend(lastSent.current, point, now)) return;
        lastSent.current = { ...point, at: now };
        try {
          const { data } = await api.post("/me/location", {
            lat: coords.latitude.toFixed(6),
            lng: coords.longitude.toFixed(6),
            accuracy_m: coords.accuracy ? coords.accuracy.toFixed(1) : null,
            recorded_at: new Date(timestamp).toISOString(),
          });
          if (!data.tracking) setShouldTrack(false);
        } catch {
          // Falha de rede: libera o próximo envio sem esperar o intervalo.
          lastSent.current = null;
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [shouldTrack]);

  const value = useMemo(() => ({ status, refresh }), [status, refresh]);
  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}
