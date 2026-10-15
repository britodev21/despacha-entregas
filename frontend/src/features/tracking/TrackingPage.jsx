import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapPinOff, Radar } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { api } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { Badge } from "@/components/ui/Badge/Badge";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { cx } from "@/lib/cx";
import { escapeHtml } from "@/lib/escapeHtml";
import { formatElapsed } from "@/lib/time";
import { usePolling, useNow } from "@/lib/usePolling";
import { useQuery } from "@/lib/useQuery";

import styles from "./tracking.module.css";

// Tiles configuráveis: em produção use um provedor com plano adequado
// (a política dos servidores oficiais do OSM proíbe uso comercial intenso).
const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const BRAZIL_CENTER = [-14.235, -51.925];
const STALE_AFTER_MS = 5 * 60 * 1000; // sem sinal há mais de 5 min
const REFRESH_MS = 15_000;

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase();
}

function isStale(location, now) {
  return now - new Date(location.recorded_at) > STALE_AFTER_MS;
}

/**
 * Marcador com as iniciais do entregador (divIcon: HTML/CSS, sem imagens,
 * o que evita o problema clássico dos ícones do Leaflet com bundlers).
 * O divIcon recebe HTML cru: o nome vem do cadastro, então é ESCAPADO.
 */
function markerIcon(deliverer, stale) {
  const tone = deliverer.issues ? "issue" : "route";
  return L.divIcon({
    className: "",
    html: `<span class="${cx(styles.marker, styles[tone], stale && styles.stale)}">${escapeHtml(initials(deliverer.name))}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

/** Ajusta o enquadramento para mostrar todos os entregadores (uma vez). */
function FitBounds({ points }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    fitted.current = true;
  }, [map, points]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [map, target]);
  return null;
}

export function TrackingPage() {
  const now = useNow(15_000);
  const [focus, setFocus] = useState(null);
  const { data, error, loading, reload } = useQuery(
    (signal) => api.get("/tracking/deliverers", { signal }).then((r) => r.data),
    [],
  );
  usePolling(reload, REFRESH_MS);

  const deliverers = useMemo(() => data ?? [], [data]);
  const located = deliverers.filter((d) => d.last_location);
  const points = useMemo(
    () => located.map((d) => [Number(d.last_location.lat), Number(d.last_location.lng)]),
    [located],
  );

  return (
    <>
      <PageHeader
        title="Mapa"
        description="Entregadores em operação e a última posição de cada um. Atualiza a cada 15 s."
      />

      {error && (
        <Alert tone="danger" title="Não foi possível atualizar o mapa.">
          {error.message}
        </Alert>
      )}

      <div className={styles.layout}>
        <div className={styles.mapWrap}>
          <MapContainer center={BRAZIL_CENTER} zoom={4} className={styles.map} scrollWheelZoom>
            {/* A página usa Referrer-Policy no-referrer, mas o OSM exige Referer nos tiles:
                só aqui enviamos a origem (sem caminho, logo sem IDs de entrega). */}
            <TileLayer
              url={TILE_URL}
              attribution={TILE_ATTRIBUTION}
              referrerPolicy="strict-origin-when-cross-origin"
              className={styles.tiles}
            />
            <FitBounds points={points} />
            <FlyTo target={focus} />
            {located.map((deliverer) => {
              const stale = isStale(deliverer.last_location, now);
              return (
                <Marker
                  key={deliverer.id}
                  position={[
                    Number(deliverer.last_location.lat),
                    Number(deliverer.last_location.lng),
                  ]}
                  icon={markerIcon(deliverer, stale)}
                  title={deliverer.name}
                >
                  <Popup>
                    <strong>{deliverer.name}</strong>
                    <br />
                    {deliverer.current_delivery &&
                      `#${deliverer.current_delivery.number} · ${deliverer.current_delivery.recipient_name}`}
                    <br />
                    Atualizado há {formatElapsed(deliverer.last_location.recorded_at, now)}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          {data && located.length === 0 && (
            <div className={styles.mapOverlay}>
              <MapPinOff aria-hidden="true" />
              Nenhuma posição recebida ainda.
            </div>
          )}
        </div>

        <aside className={styles.list} aria-label="Entregadores em operação">
          {!data && loading ? (
            <>
              <Skeleton height="5rem" />
              <Skeleton height="5rem" />
            </>
          ) : deliverers.length === 0 ? (
            <EmptyState
              icon={Radar}
              title="Ninguém em operação"
              description="Entregadores com entregas atribuídas ou em rota aparecem aqui."
            />
          ) : (
            deliverers.map((deliverer) => {
              const location = deliverer.last_location;
              const stale = location && isStale(location, now);
              return (
                <button
                  key={deliverer.id}
                  type="button"
                  className={styles.item}
                  disabled={!location}
                  onClick={() => setFocus([Number(location.lat), Number(location.lng)])}
                >
                  <span className={styles.itemTop}>
                    <span className={styles.itemName}>{deliverer.name}</span>
                    {deliverer.issues > 0 && <Badge tone="issue">Ocorrência</Badge>}
                  </span>
                  <span className={styles.itemCounts}>
                    {deliverer.in_route} em rota · {deliverer.assigned} a sair
                  </span>
                  {deliverer.current_delivery && (
                    <span className={styles.itemDelivery}>
                      #{deliverer.current_delivery.number} ·{" "}
                      {deliverer.current_delivery.recipient_name} ·{" "}
                      {deliverer.current_delivery.neighborhood}
                    </span>
                  )}
                  <span className={cx(styles.itemSignal, stale && styles.itemStale)}>
                    {location
                      ? `${stale ? "Sem sinal recente · " : ""}atualizado há ${formatElapsed(location.recorded_at, now)}`
                      : "Sem localização ainda"}
                  </span>
                </button>
              );
            })
          )}
        </aside>
      </div>
    </>
  );
}
