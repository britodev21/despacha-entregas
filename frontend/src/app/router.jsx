import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";

import { RootRoute } from "@/app/RootRoute";
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
    element: <RootRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/login", element: <LoginPage />, handle: { title: "Entrar" } },
      // "/": apresentação para visitantes; quem tem sessão vai para a sua área.
      { index: true, element: <HomeRoute />, handle: { title: "Gestão de entregas" } },
      // Páginas públicas sob demanda (fora dos layouts, então com Suspense próprio).
      {
        path: "/suporte",
        element: withSuspense(<SupportPage />),
        handle: { title: "Central de ajuda" },
      },
      {
        path: "/privacidade",
        element: withSuspense(<PrivacyPage />),
        handle: { title: "Privacidade" },
      },
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
      ...(import.meta.env.DEV
        ? [{ path: "/status", element: withSuspense(<SystemStatusPage />) }]
        : []),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
