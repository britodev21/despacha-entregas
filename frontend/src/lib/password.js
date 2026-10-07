// Sem caracteres ambíguos (0/O, 1/l/I): a senha costuma ser ditada ou
// enviada por mensagem para o entregador.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Senha aleatória com gerador criptográfico do navegador (nunca Math.random). */
export function generatePassword(length = 14) {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join("");
}
