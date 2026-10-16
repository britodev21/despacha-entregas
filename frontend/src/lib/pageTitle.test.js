// @vitest-environment node
import { describe, expect, it } from "vitest";

import { formatDocumentTitle } from "./pageTitle";

describe("formatDocumentTitle", () => {
  it("coloca o nome da tela antes do nome do sistema", () => {
    expect(formatDocumentTitle("Operação")).toBe("Operação · DESPACHA");
  });

  it("sem título, só o nome do sistema", () => {
    expect(formatDocumentTitle(null)).toBe("DESPACHA");
  });
});
