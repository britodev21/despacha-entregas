// @vitest-environment node
import { describe, expect, it } from "vitest";

import { distanceMeters, MIN_INTERVAL_MS, shouldSend } from "./locationThrottle";

const paulista = { lat: -23.561684, lng: -46.655981 };

describe("distanceMeters", () => {
  it("mesmo ponto = 0 m", () => {
    expect(distanceMeters(paulista, paulista)).toBe(0);
  });

  it("0,001° de latitude ≈ 111 m", () => {
    const north = { ...paulista, lat: paulista.lat + 0.001 };
    expect(distanceMeters(paulista, north)).toBeGreaterThan(105);
    expect(distanceMeters(paulista, north)).toBeLessThan(115);
  });
});

describe("shouldSend", () => {
  const now = 1_000_000;

  it("primeira leitura sempre envia", () => {
    expect(shouldSend(null, paulista, now)).toBe(true);
  });

  it("parado e há pouco tempo: não envia", () => {
    const last = { ...paulista, at: now - 5_000 };
    expect(shouldSend(last, { lat: paulista.lat + 0.0001, lng: paulista.lng }, now)).toBe(false);
  });

  it("passou o intervalo: envia mesmo parado", () => {
    const last = { ...paulista, at: now - MIN_INTERVAL_MS };
    expect(shouldSend(last, paulista, now)).toBe(true);
  });

  it("andou mais de 50 m: envia antes do intervalo", () => {
    const last = { ...paulista, at: now - 3_000 };
    expect(shouldSend(last, { lat: paulista.lat + 0.001, lng: paulista.lng }, now)).toBe(true);
  });
});
