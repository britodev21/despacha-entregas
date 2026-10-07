/**
 * Converte o erro da API em erros por campo + mensagem geral do formulário.
 *
 * 422 → details[] já vem com { field, message } (em português, do backend).
 * 409 → códigos conhecidos apontam para o campo responsável.
 */
const CONFLICT_FIELDS = {
  EMAIL_TAKEN: "email",
  PHONE_TAKEN: "phone",
  WRONG_CURRENT_PASSWORD: "current_password",
  SAME_PASSWORD: "new_password",
};

export function splitApiError(apiError) {
  const fields = {};
  let form = null;

  for (const detail of apiError.details ?? []) {
    if (detail.field) fields[detail.field] ??= detail.message;
    else form ??= detail.message; // erro do objeto inteiro (ex.: "Informe e-mail ou telefone.")
  }

  const conflictField = CONFLICT_FIELDS[apiError.code];
  if (conflictField) fields[conflictField] = apiError.message;
  else if (!Object.keys(fields).length) form ??= apiError.message;

  return { fields, form };
}
