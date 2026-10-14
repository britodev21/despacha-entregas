import { formatMoney, PAYMENT_LABELS } from "@/lib/money";

const FINAL = new Set(["DELIVERED", "CANCELED"]);

export function isFinal(delivery) {
  return FINAL.has(delivery.status);
}

/** Passou da previsão e ainda não terminou. */
export function isLate(delivery, now = new Date()) {
  return (
    Boolean(delivery.expected_at) && !isFinal(delivery) && new Date(delivery.expected_at) < now
  );
}

/** "Rua das Flores, 45 · Apto 2" */
export function streetLine(delivery) {
  const line = `${delivery.street}, ${delivery.address_number}`;
  return delivery.complement ? `${line} · ${delivery.complement}` : line;
}

/** Endereço completo em uma linha (para mapas e cópia). */
export function fullAddress(delivery) {
  return `${delivery.street}, ${delivery.address_number} - ${delivery.neighborhood}, ${delivery.city} - ${delivery.state}`;
}

/**
 * Link universal do Google Maps (ADR-09): no celular abre o app instalado,
 * no computador abre o site. Coordenadas, se houver, são mais precisas.
 */
export function mapsUrl(delivery) {
  const destination =
    delivery.lat && delivery.lng ? `${delivery.lat},${delivery.lng}` : fullAddress(delivery);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** "Dinheiro · troco p/ R$ 100,00" */
export function paymentSummary(delivery) {
  if (!delivery.payment_method) return null;
  const label = PAYMENT_LABELS[delivery.payment_method];
  return delivery.change_for ? `${label} · troco p/ ${formatMoney(delivery.change_for)}` : label;
}

/** Link do Waze (alternativa ao Google Maps, muito usada por motoboys). */
export function wazeUrl(delivery) {
  if (delivery.lat && delivery.lng) {
    return `https://waze.com/ul?ll=${delivery.lat},${delivery.lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(fullAddress(delivery))}&navigate=yes`;
}

/**
 * O que o entregador precisa cobrar, em linguagem direta.
 * Troco calculado em centavos inteiros (sem erro de ponto flutuante).
 */
export function collectInstructions(delivery) {
  if (delivery.payment_method === "PREPAID")
    return { tone: "success", text: "Já pago. Não cobrar." };
  if (!delivery.order_amount) return null;
  const amount = formatMoney(delivery.order_amount);
  const method = delivery.payment_method ? PAYMENT_LABELS[delivery.payment_method] : null;
  let text = method ? `Cobrar ${amount} · ${method}` : `Cobrar ${amount}`;
  if (delivery.payment_method === "CASH" && delivery.change_for) {
    const cents =
      Math.round(Number(delivery.change_for) * 100) -
      Math.round(Number(delivery.order_amount) * 100);
    text += ` · troco para ${formatMoney(delivery.change_for)} (levar ${formatMoney(cents / 100)})`;
  }
  return { tone: "warning", text };
}
