// @vitest-environment node
import { describe, expect, it } from "vitest";

import { splitApiError } from "./formErrors";

describe("splitApiError", () => {
  it("distribui erros 422 por campo e o erro do objeto para o formulário", () => {
    const result = splitApiError({
      code: "VALIDATION_ERROR",
      message: "Verifique os campos destacados.",
      details: [
        { field: "email", message: "E-mail inválido." },
        { field: "", message: "Informe e-mail ou telefone." },
      ],
    });
    expect(result).toEqual({
      fields: { email: "E-mail inválido." },
      form: "Informe e-mail ou telefone.",
    });
  });

  it("aponta conflitos conhecidos para o campo certo", () => {
    const result = splitApiError({ code: "PHONE_TAKEN", message: "Este telefone já está em uso." });
    expect(result.fields).toEqual({ phone: "Este telefone já está em uso." });
    expect(result.form).toBeNull();
  });

  it("erro desconhecido vira mensagem geral", () => {
    expect(splitApiError({ code: "X", message: "Falhou." })).toEqual({
      fields: {},
      form: "Falhou.",
    });
  });
});
