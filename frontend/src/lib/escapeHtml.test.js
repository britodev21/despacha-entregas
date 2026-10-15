// @vitest-environment node
import { describe, expect, it } from "vitest";

import { escapeHtml } from "./escapeHtml";

describe("escapeHtml", () => {
  it("neutraliza tags e atributos", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });

  it("mantém texto comum intacto", () => {
    expect(escapeHtml("AE")).toBe("AE");
  });
});
