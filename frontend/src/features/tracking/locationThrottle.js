/**
 * Decide se uma nova posição deve ser enviada ao servidor.
 *
 * Envia a cada 20 s OU quando a pessoa andou 50 m, o que vier primeiro.
 * Parado no semáforo: poucos envios. Andando rápido: o mapa acompanha.
 * Economiza bateria, dados móveis e banco de dados.
 */
export const MIN_INTERVAL_MS = 20_000;
export const MIN_DISTANCE_M = 50;

const EARTH_RADIUS_M = 6_371_000;

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * last: { lat, lng, at } do último envio (ou null)
 * next: { lat, lng } da nova leitura do GPS
 */
export function shouldSend(last, next, now) {
  if (!last) return true;
  if (now - last.at >= MIN_INTERVAL_MS) return true;
  return distanceMeters(last, next) >= MIN_DISTANCE_M;
}
