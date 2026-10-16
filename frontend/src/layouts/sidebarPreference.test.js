// @vitest-environment node
import { describe, expect, it } from "vitest";

import { initialCollapsed } from "./sidebarPreference";

describe("initialCollapsed", () => {
  it("respeita a escolha salva", () => {
    expect(initialCollapsed("collapsed", false)).toBe(true);
    expect(initialCollapsed("expanded", true)).toBe(false);
  });

  it("sem escolha, recolhe só em notebook pequeno", () => {
    expect(initialCollapsed(null, true)).toBe(true);
    expect(initialCollapsed(null, false)).toBe(false);
  });

  it("ignora valor salvo inválido", () => {
    expect(initialCollapsed("qualquer", undefined)).toBe(false);
  });
});
