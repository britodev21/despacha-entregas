/**
 * Posição atual do celular, uma única vez (não é rastreamento contínuo).
 *
 * Sempre opcional: se a pessoa negar a permissão, o GPS demorar ou o
 * navegador não suportar, devolvemos null e o fluxo segue normalmente.
 * Observação: a Geolocation API só funciona em HTTPS ou em localhost.
 */
export function getCurrentPosition({ timeoutMs = 6000 } = {}) {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ lat: coords.latitude.toFixed(6), lng: coords.longitude.toFixed(6) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}
