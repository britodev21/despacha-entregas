/** Formatação de dados para exibição (a API guarda só dígitos). */

export function formatZip(digits) {
  return digits?.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : (digits ?? "");
}

export function formatDocument(digits) {
  if (!digits) return "";
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digits;
}

/** "Avenida Paulista, 1000 · Apto 42" */
export function formatStreetLine(address) {
  const line = `${address.street}, ${address.number}`;
  return address.complement ? `${line} · ${address.complement}` : line;
}

/** "Bela Vista · São Paulo/SP" */
export function formatAreaLine(address) {
  return `${address.neighborhood} · ${address.city}/${address.state}`;
}

export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]; // prettier-ignore
