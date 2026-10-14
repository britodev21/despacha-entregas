// @vitest-environment node
import { describe, expect, it } from "vitest";

import { collectInstructions, isLate, mapsUrl, wazeUrl } from "./deliveryHelpers";

const base = {
  status: "IN_ROUTE",
  street: "Avenida Paulista",
  address_number: "1578",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  lat: null,
  lng: null,
};

const clean = (text) => text.replace(/\s/g, " ");

describe("collectInstructions", () => {
  it("calcula o troco em centavos, sem erro de ponto flutuante", () => {
    const result = collectInstructions({
      ...base,
      order_amount: "58.90",
      payment_method: "CASH",
      change_for: "100.00",
    });
    expect(clean(result.text)).toBe(
      "Cobrar R$ 58,90 · Dinheiro · troco para R$ 100,00 (levar R$ 41,10)",
    );
  });

  it("caso clássico de float: 0,30 de troco não vira 0,29999", () => {
    const result = collectInstructions({
      ...base,
      order_amount: "0.70",
      payment_method: "CASH",
      change_for: "1.00",
    });
    expect(clean(result.text)).toContain("(levar R$ 0,30)");
  });

  it("pedido já pago avisa para não cobrar", () => {
    const result = collectInstructions({ ...base, payment_method: "PREPAID", order_amount: "10" });
    expect(result).toEqual({ tone: "success", text: "Já pago. Não cobrar." });
  });

  it("sem valor e sem forma de pagamento, nada a cobrar", () => {
    expect(collectInstructions({ ...base, order_amount: null, payment_method: null })).toBeNull();
  });
});

describe("isLate", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("atrasada quando passou da previsão e não terminou", () => {
    expect(isLate({ ...base, expected_at: "2026-10-14T11:59:00Z" }, now)).toBe(true);
  });

  it("entregue nunca é atrasada", () => {
    expect(isLate({ ...base, status: "DELIVERED", expected_at: "2026-10-14T11:00:00Z" }, now)).toBe(
      false,
    );
  });

  it("sem previsão não é atrasada", () => {
    expect(isLate({ ...base, expected_at: null }, now)).toBe(false);
  });
});

describe("links de navegação", () => {
  it("usa o endereço quando não há coordenadas", () => {
    const url = new URL(mapsUrl(base));
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("destination")).toBe(
      "Avenida Paulista, 1578 - Bela Vista, São Paulo - SP",
    );
  });

  it("prefere coordenadas quando existem", () => {
    const delivery = { ...base, lat: "-23.561684", lng: "-46.655981" };
    expect(new URL(mapsUrl(delivery)).searchParams.get("destination")).toBe(
      "-23.561684,-46.655981",
    );
    expect(wazeUrl(delivery)).toContain("ll=-23.561684,-46.655981");
  });
});
