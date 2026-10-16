import { lazy } from "react";
import { createBrowserRouter } from "react-router";

import { RootRoute } from "@/app/RootRoute";

import { HomeRedirect, RequireAuth, RequirePermission } from "@/auth/guards";
import { PERMISSIONS } from "@/auth/permissions";
import { LoginPage } from "@/features/auth/LoginPage";
import { NotFoundPage } from "@/features/system/NotFoundPage";
import { RouteErrorPage } from "@/features/system/RouteErrorPage";
import { LazyTrackingPage } from "@/features/tracking/LazyTrackingPage";
import { AppLayout } from "@/layouts/AppLayout";
import { DelivererLayout } from "@/layouts/DelivererLayout";

// Cada tela é baixada só quando aberta: o celular do entregador não carrega o
// painel do operador, e vice-versa. O carregamento aparece no <Suspense> dos
// layouts. Login e layouts ficam no pacote inicial (primeira tela rápida).
const lazyPage = (load, name) => lazy(() => load().then((module) => ({ default: module[name] })));

const DashboardPage = lazyPage(() => import("@/features/dashboard/DashboardPage"), "DashboardPage");
const OperationsPage = lazyPage(
  () => import("@/features/deliveries/OperationsPage"),
  "OperationsPage",
);
const HistoryPage = lazyPage(() => import("@/features/history/HistoryPage"), "HistoryPage");
const ClientsPage = lazyPage(() => import("@/features/clients/ClientsPage"), "ClientsPage");
const ClientDetailPage = lazyPage(
  () => import("@/features/clients/ClientDetailPage"),
  "ClientDetailPage",
);
const AuditPage = lazyPage(() => import("@/features/audit/AuditPage"), "AuditPage");
const SettingsPage = lazyPage(() => import("@/features/settings/SettingsPage"), "SettingsPage");
const UsersPage = lazyPage(() => import("@/features/users/UsersPage"), "UsersPage");
const DelivererHomePage = lazyPage(
  () => import("@/features/deliverer/DelivererHomePage"),
  "DelivererHomePage",
);
const DelivererDeliveryPage = lazyPage(
  () => import("@/features/deliverer/DelivererDeliveryPage"),
  "DelivererDeliveryPage",
);
const SystemStatusPage = lazyPage(
  () => import("@/features/system/SystemStatusPage"),
  "SystemStatusPage",
);

export const router = createBrowserRouter([
  {
    element: <RootRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/login", element: <LoginPage />, handle: { title: "Entrar" } },
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
              { path: "painel", element: <DashboardPage />, handle: { title: "Painel" } },
              {
                path: "entregas",
                handle: { title: "Operação" },
                element: (
                  <RequirePermission permission={PERMISSIONS.DELIVERIES_MANAGE}>
                    <OperationsPage />
                  </RequirePermission>
                ),
              },
              {
                path: "historico",
                handle: { title: "Histórico" },
                element: (
                  <RequirePermission permission={PERMISSIONS.DELIVERIES_MANAGE}>
                    <HistoryPage />
                  </RequirePermission>
                ),
              },
              {
                path: "mapa",
                handle: { title: "Mapa" },
                element: (
                  <RequirePermission permission={PERMISSIONS.TRACKING_READ}>
                    <LazyTrackingPage />
                  </RequirePermission>
                ),
              },
              {
                path: "clientes",
                element: <RequirePermission permission={PERMISSIONS.CLIENTS_MANAGE} />,
                children: [
                  { index: true, element: <ClientsPage />, handle: { title: "Clientes" } },
                  {
                    path: ":clientId",
                    element: <ClientDetailPage />,
                    handle: { title: "Cliente" },
                  },
                ],
              },
              {
                path: "auditoria",
                handle: { title: "Auditoria" },
                element: (
                  <RequirePermission permission={PERMISSIONS.AUDIT_READ}>
                    <AuditPage />
                  </RequirePermission>
                ),
              },
              {
                path: "configuracoes",
                handle: { title: "Configurações" },
                element: (
                  <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                    <SettingsPage />
                  </RequirePermission>
                ),
              },
              {
                path: "usuarios",
                handle: { title: "Usuários" },
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
              { index: true, element: <DelivererHomePage />, handle: { title: "Minhas entregas" } },
              {
                path: "entregas/:deliveryId",
                element: <DelivererDeliveryPage />,
                handle: { title: "Entrega" },
              },
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
