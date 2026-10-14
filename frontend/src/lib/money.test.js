// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatMoney, moneyToInput, parseMoney } from "./money";

describe("parseMoney", () => {
  it.each([
    ["58,90", "58.90"],
    ["58.90", "58.90"],
    ["1.234,50", "1234.50"],
    ["R$ 10", "10.00"],
    ["  7 ", "7.00"],
  ])("converte %s em %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it("vazio vira null (campo opcional)", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });

  it.each(["abc", "10,999", "-5", "1,2,3"])("rejeita %s", (input) => {
    expect(parseMoney(input)).toBeUndefined();
  });
});

describe("formatação", () => {
  it("formata em reais", () => {
    expect(formatMoney("1234.5").replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(formatMoney(null)).toBe("");
  });

  it("prepara o valor para o campo do formulário", () => {
    expect(moneyToInput("58.90")).toBe("58,90");
    expect(moneyToInput(null)).toBe("");
  });
});
