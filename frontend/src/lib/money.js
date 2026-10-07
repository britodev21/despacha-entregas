/**
 * Dinheiro trafega como TEXTO decimal ("58.90"), nunca como número de ponto
 * flutuante: 0.1 + 0.2 = 0.30000000000000004 em JavaScript.
 */
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "58.90" → "R$ 58,90". Só para exibir (Number aqui é seguro: não fazemos conta). */
export function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "";
  return currency.format(Number(value));
}

/** "58.90" → "58,90" para preencher um campo de formulário. */
export function moneyToInput(value) {
  return value ? String(value).replace(".", ",") : "";
}

/**
 * Texto digitado → decimal para a API.
 * Aceita "58,90", "58.90", "1.234,50", "R$ 10". Vazio → null.
 * Inválido → undefined (o formulário mostra o erro).
 */
export function parseMoney(input) {
  const raw = String(input ?? "")
    .replace(/R\$|\s/g, "")
    .trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  return Number(normalized).toFixed(2);
}

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Dinheiro" },
  { value: "PIX", label: "Pix" },
  { value: "CREDIT_CARD", label: "Cartão de crédito" },
  { value: "DEBIT_CARD", label: "Cartão de débito" },
  { value: "PREPAID", label: "Já pago" },
  { value: "OTHER", label: "Outro" },
];

export const PAYMENT_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));
