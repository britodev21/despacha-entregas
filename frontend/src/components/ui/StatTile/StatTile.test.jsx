import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatTile } from "./StatTile";

describe("StatTile", () => {
  it("mostra rótulo, valor e delta com sinal contra um período nomeado", () => {
    render(
      <StatTile
        label="Entregas hoje"
        value={12}
        delta={{ value: 3, label: "vs. ontem até agora" }}
      />,
    );
    expect(screen.getByText("Entregas hoje")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("+3 vs. ontem até agora")).toBeInTheDocument();
  });

  it("delta negativo e zero aparecem sem sinal de mais", () => {
    const { rerender } = render(
      <StatTile label="Entregas hoje" value={4} delta={{ value: -2, label: "vs. ontem" }} />,
    );
    expect(screen.getByText("-2 vs. ontem")).toBeInTheDocument();
    rerender(<StatTile label="Entregas hoje" value={4} delta={{ value: 0, label: "vs. ontem" }} />);
    expect(screen.getByText("0 vs. ontem")).toBeInTheDocument();
  });
});
