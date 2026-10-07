/** Formata telefone salvo pela API (5511987654321) para exibição: (11) 98765-4321. */
export function formatPhone(digits) {
  if (!digits) return "";
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const match = local.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : digits;
}
