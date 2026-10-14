import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api/client";
import { ToastProvider } from "@/components/ui/Toast/ToastProvider";

import { DelivererDeliveryPage } from "./DelivererDeliveryPage";

vi.mock("@/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  toApiError: (error) => ({ status: error?.status ?? 0, message: "Falhou" }),
}));

function delivery(overrides = {}) {
  return {
    id: "d1",
    number: 7,
    status: "ASSIGNED",
    recipient_name: "Dona Maria",
    recipient_phone: "5511977776666",
    zip_code: "01310100",
    street: "Avenida Paulista",
    address_number: "1578",
    complement: null,
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    reference: "Prédio do museu",
    lat: null,
    lng: null,
    notes: "Tocar o interfone 12",
    order_amount: "58.90",
    payment_method: "CASH",
    change_for: "100.00",
    delivery_fee: null,
    expected_at: null,
    deliverer: { id: "u1", name: "Edu", phone: null },
    cancel_reason: null,
    created_at: "2026-10-14T12:00:00Z",
    assigned_at: "2026-10-14T12:00:00Z",
    started_at: null,
    delivered_at: null,
    canceled_at: null,
    occurrences: [],
    proof: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/entregador/entregas/d1"]}>
        <Routes>
          <Route path="/entregador/entregas/:deliveryId" element={<DelivererDeliveryPage />} />
          <Route path="/entregador" element={<p>Lista de entregas</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe("DelivererDeliveryPage", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it("mostra o essencial para a rua: endereço, referência, navegação e cobrança", async () => {
    api.get.mockResolvedValue({ data: delivery() });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Dona Maria" })).toBeInTheDocument();
    expect(screen.getByText("Avenida Paulista, 1578")).toBeInTheDocument();
    expect(screen.getByText("Prédio do museu")).toBeInTheDocument();

    const maps = screen.getByRole("link", { name: /Google Maps/ });
    expect(maps).toHaveAttribute("href", expect.stringContaining("google.com/maps/dir"));
    expect(screen.getByRole("link", { name: /Ligar/ })).toHaveAttribute(
      "href",
      "tel:+5511977776666",
    );
    expect(screen.getByText(/levar R\$\s41,10/)).toBeInTheDocument();
  });

  it("inicia a entrega e passa a oferecer finalizar", async () => {
    api.get
      .mockResolvedValueOnce({ data: delivery() })
      .mockResolvedValueOnce({ data: delivery({ status: "IN_ROUTE" }) });
    api.post.mockResolvedValue({ data: delivery({ status: "IN_ROUTE" }) });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /Iniciar entrega/ }));

    expect(api.post).toHaveBeenCalledWith("/me/deliveries/d1/start");
    expect(await screen.findByRole("button", { name: /Finalizar entrega/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar ocorrência/ })).toBeInTheDocument();
  });

  it("finaliza com o nome de quem recebeu e volta para a lista", async () => {
    api.get.mockResolvedValue({ data: delivery({ status: "IN_ROUTE" }) });
    api.post.mockResolvedValue({ data: delivery({ status: "DELIVERED" }) });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /Finalizar entrega/ }));
    await userEvent.type(screen.getByLabelText("Quem recebeu"), "Porteiro João");
    await userEvent.click(screen.getByRole("button", { name: /Confirmar entrega/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/me/deliveries/d1/complete", {
        received_by_name: "Porteiro João",
        notes: "",
      }),
    );
    expect(await screen.findByText("Lista de entregas")).toBeInTheDocument();
  });

  it("entrega que não é dele (404) explica e oferece voltar", async () => {
    api.get.mockRejectedValue({ status: 404 });
    renderPage();
    expect(await screen.findByText("Entrega não encontrada")).toBeInTheDocument();
  });
});
