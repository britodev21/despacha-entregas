import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";

import { RequireAuth, RequirePermission } from "@/auth/guards";
import { PERMISSIONS } from "@/auth/permissions";
import { FullPageLoader } from "@/components/ui/FullPageLoader/FullPageLoader";
import { LoginPage } from "@/features/auth/LoginPage";
import { HomeRoute } from "@/features/landing/HomeRoute";
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
const SupportPage = lazyPage(() => import("@/features/support/SupportPage"), "SupportPage");
const PrivacyPage = lazyPage(() => import("@/features/privacy/PrivacyPage"), "PrivacyPage");
const SystemStatusPage = lazyPage(
  () => import("@/features/system/SystemStatusPage"),
  "SystemStatusPage",
);

const withSuspense = (element) => (
  <Suspense fallback={<FullPageLoader label="Carregando" />}>{element}</Suspense>
);

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/login", element: <LoginPage /> },
      // "/": apresentação para visitantes; quem tem sessão vai para a sua área.
      { index: true, element: <HomeRoute /> },
      // Páginas públicas sob demanda (fora dos layouts, então com Suspense próprio).
      { path: "/suporte", element: withSuspense(<SupportPage />) },
      { path: "/privacidade", element: withSuspense(<PrivacyPage />) },
      {
        element: <RequireAuth />,
        children: [
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
                path: "historico",
                element: (
                  <RequirePermission permission={PERMISSIONS.DELIVERIES_MANAGE}>
                    <HistoryPage />
                  </RequirePermission>
                ),
              },
              {
                path: "mapa",
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
                  { index: true, element: <ClientsPage /> },
                  { path: ":clientId", element: <ClientDetailPage /> },
                ],
              },
              {
                path: "auditoria",
                element: (
                  <RequirePermission permission={PERMISSIONS.AUDIT_READ}>
                    <AuditPage />
                  </RequirePermission>
                ),
              },
              {
                path: "configuracoes",
                element: (
                  <RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}>
                    <SettingsPage />
                  </RequirePermission>
                ),
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
      ...(import.meta.env.DEV
        ? [{ path: "/status", element: withSuspense(<SystemStatusPage />) }]
        : []),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
