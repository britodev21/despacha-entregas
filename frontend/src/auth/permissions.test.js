// @vitest-environment node
import { describe, expect, it } from "vitest";

import { canAccessPath, homePathFor } from "./permissions";

const operator = {
  role: "OPERATOR",
  permissions: ["dashboard:read", "deliveries:manage", "clients:manage"],
};
const deliverer = { role: "DELIVERER", permissions: ["deliveries:own", "tracking:send"] };

describe("homePathFor", () => {
  it("leva cada perfil para a sua tela inicial", () => {
    expect(homePathFor(operator)).toBe("/painel");
    expect(homePathFor(deliverer)).toBe("/entregador");
  });
});

describe("canAccessPath (retorno após login)", () => {
  it("operador pode voltar para clientes, mas não para usuários", () => {
    expect(canAccessPath(operator, "/clientes/123")).toBe(true);
    expect(canAccessPath(operator, "/usuarios")).toBe(false);
  });

  it("entregador não volta para o painel deixado por outra sessão", () => {
    expect(canAccessPath(deliverer, "/painel")).toBe(false);
    expect(canAccessPath(deliverer, "/entregador/entregas/1")).toBe(true);
  });
});
