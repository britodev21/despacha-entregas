// @vitest-environment node
import { describe, expect, it } from "vitest";

import { whatsappUrl } from "./contact";

describe("whatsappUrl", () => {
  it("acrescenta o código do Brasil a DDD + número", () => {
    expect(whatsappUrl("(67) 99999-0000", "Oi")).toBe("https://wa.me/5567999990000?text=Oi");
  });

  it("mantém número que já vem com código do país", () => {
    expect(whatsappUrl("5567999990000", "Oi")).toBe("https://wa.me/5567999990000?text=Oi");
  });

  it("codifica a mensagem", () => {
    expect(whatsappUrl("67999990000", "Olá! Quero conhecer")).toBe(
      "https://wa.me/5567999990000?text=Ol%C3%A1!%20Quero%20conhecer",
    );
  });

  it("sem número válido, não há link", () => {
    expect(whatsappUrl(undefined)).toBeNull();
    expect(whatsappUrl("")).toBeNull();
    expect(whatsappUrl("12345")).toBeNull();
  });
});
