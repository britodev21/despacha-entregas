const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Escapa texto para colocar dentro de HTML montado como string.
 * O React já faz isso sozinho; só é preciso quando uma biblioteca pede HTML
 * cru (ex.: o divIcon do Leaflet). Sem isso, um nome cadastrado como
 * "<img onerror=...>" viraria código na página (XSS).
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);
}
