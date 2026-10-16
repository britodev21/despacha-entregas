// @vitest-environment node
import { describe, expect, it } from "vitest";

import { matchesQuery, normalizeText } from "./searchText";

describe("normalizeText", () => {
  it("remove acentos e deixa minúsculo", () => {
    expect(normalizeText("  Localização do ENTREGADOR ")).toBe("localizacao do entregador");
  });

  it("aceita valores vazios", () => {
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("matchesQuery", () => {
  const text = "Esqueci minha senha. Peça ao administrador para redefinir.";

  it("ignora acentos e maiúsculas", () => {
    expect(matchesQuery(text, "PECA ao ADMIN")).toBe(true);
  });

  it("exige todas as palavras, em qualquer ordem", () => {
    expect(matchesQuery(text, "redefinir senha")).toBe(true);
    expect(matchesQuery(text, "senha mapa")).toBe(false);
  });

  it("consulta vazia casa tudo", () => {
    expect(matchesQuery(text, "   ")).toBe(true);
  });
});
