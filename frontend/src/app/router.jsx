import { createBrowserRouter } from "react-router";

import { HomeRedirect, RequireAuth, RequirePermission } from "@/auth/guards";
import { PERMISSIONS } from "@/auth/permissions";
import { LoginPage } from "@/features/auth/LoginPage";
import { ClientDetailPage } from "@/features/clients/ClientDetailPage";
import { ClientsPage } from "@/features/clients/ClientsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { OperationsPage } from "@/features/deliveries/OperationsPage";
import { DelivererDeliveryPage } from "@/features/deliverer/DelivererDeliveryPage";
import { DelivererHomePage } from "@/features/deliverer/DelivererHomePage";
import { NotFoundPage } from "@/features/system/NotFoundPage";
import { RouteErrorPage } from "@/features/system/RouteErrorPage";
import { SystemStatusPage } from "@/features/system/SystemStatusPage";
import { UsersPage } from "@/features/users/UsersPage";
import { AppLayout } from "@/layouts/AppLayout";
import { DelivererLayout } from "@/layouts/DelivererLayout";

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/login", element: <LoginPage /> },
      {
        path: "/",
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            // Painel: admin e operador
            element: (
              <RequirePermission permission={PERMISSIONS.DASHBOARD_READ}>
                <AppLayout />
              </RequirePermission>
            ),
            children: [
              { path: "painel", element: <DashboardPage /> },
              {
                path: "entregas",
                element: (
                  <RequirePermission permission={PERMISSIONS.DELIVERIES_MANAGE}>
                    <OperationsPage />
                  </RequirePermission>
                ),
              },
              {
                path: "clientes",
                element: <RequirePermission permission={PERMISSIONS.CLIENTS_MANAGE} />,
                children: [
                  { index: true, element: <ClientsPage /> },
                  { path: ":clientId", element: <ClientDetailPage /> },
                ],
              },
              {
                path: "usuarios",
                element: (
                  <RequirePermission permission={PERMISSIONS.USERS_MANAGE}>
                    <UsersPage />
                  </RequirePermission>
                ),
              },
            ],
          },
          {
            // Área do entregador
            path: "entregador",
            element: (
              <RequirePermission permission={PERMISSIONS.DELIVERIES_OWN}>
                <DelivererLayout />
              </RequirePermission>
            ),
            children: [
              { index: true, element: <DelivererHomePage /> },
              { path: "entregas/:deliveryId", element: <DelivererDeliveryPage /> },
            ],
          },
        ],
      },
      // Página de diagnóstico: só em desenvolvimento.
      ...(import.meta.env.DEV ? [{ path: "/status", element: <SystemStatusPage /> }] : []),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
