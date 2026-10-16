/** Texto para comparação: minúsculo e sem acentos ("Localização" → "localizacao"). */
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Busca tolerante: todas as palavras digitadas precisam aparecer no texto,
 * em qualquer ordem, ignorando acentos e maiúsculas. Consulta vazia casa tudo.
 */
export function matchesQuery(text, query) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeText(text);
  return words.every((word) => haystack.includes(word));
}
