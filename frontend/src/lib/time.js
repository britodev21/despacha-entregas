const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

/** Hoje: "14:32". Outro dia: "05/10, 14:32". */
export function formatMoment(iso, now = new Date()) {
  if (!iso) return "";
  const date = new Date(iso);
  return isSameDay(date, now) ? timeFormat.format(date) : dateTimeFormat.format(date);
}

/** Tempo decorrido curto: "agora", "8 min", "1 h 20 min", "2 d". */
export function formatElapsed(iso, now = new Date()) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso)) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

/** Data ISO daqui a N minutos (previsão de entrega). */
export function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}
