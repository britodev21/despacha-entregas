import { Outlet } from "react-router";

import { useDocumentTitle } from "@/lib/pageTitle";

/** Raiz das rotas: mantém o título da aba do navegador em dia. */
export function RootRoute() {
  useDocumentTitle();
  return <Outlet />;
}
