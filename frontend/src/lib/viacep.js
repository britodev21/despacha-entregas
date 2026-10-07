/**
 * Consulta de CEP no ViaCEP (serviço público e gratuito).
 *
 * Sempre opcional: se a consulta falhar ou demorar, a pessoa digita o
 * endereço normalmente. Por isso nunca lançamos erro, só devolvemos null.
 */
const TIMEOUT_MS = 4000;

export async function lookupCep(cep) {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.erro) return null;
    return {
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
