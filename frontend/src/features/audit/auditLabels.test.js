// @vitest-environment node
import { describe, expect, it } from "vitest";

import { describeDetails } from "./auditLabels";

describe("describeDetails", () => {
  it("traduz mudança de status", () => {
    expect(
      describeDetails({
        action: "delivery.status_changed",
        details: { from: "PENDING", to: "ASSIGNED" },
      }),
    ).toBe("Pendente → Atribuída");
  });

  it("explica falha de login sem revelar dados", () => {
    expect(
      describeDetails({ action: "auth.login_failed", details: { reason: "wrong_password" } }),
    ).toBe("senha incorreta");
  });

  it("evento sem detalhes não quebra", () => {
    expect(describeDetails({ action: "auth.logout", details: {} })).toBe("");
  });
});
