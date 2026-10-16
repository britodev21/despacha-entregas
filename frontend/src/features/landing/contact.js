const DEFAULT_MESSAGE = "Olá! Quero conhecer o DESPACHA.";

/**
 * Link do WhatsApp para "Agendar demonstração". O número vem do build
 * (VITE_CONTACT_WHATSAPP, definido só no servidor/.env.local — nunca no
 * repositório). Aceita "67 99999-0000" ou "5567999990000"; sem número válido,
 * devolve null e a página mostra só o "Entrar".
 */
export function whatsappUrl(number, message = DEFAULT_MESSAGE) {
  const digits = String(number ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  // DDD + número (10 ou 11 dígitos): acrescenta o código do Brasil.
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export const CONTACT_URL = whatsappUrl(import.meta.env.VITE_CONTACT_WHATSAPP);
