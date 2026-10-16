import { Navigate } from "react-router";

import { useAuth } from "@/auth/AuthContext";
import { homePathFor } from "@/auth/permissions";
import { hadSession } from "@/auth/sessionHint";
import { FullPageLoader } from "@/components/ui/FullPageLoader/FullPageLoader";

import { LandingPage } from "./LandingPage";

/**
 * "/": quem tem sessão vai para a sua tela inicial; visitante vê a
 * apresentação na hora, sem esperar a verificação da sessão.
 */
export function HomeRoute() {
  const { status, user } = useAuth();
  if (status === "authenticated") return <Navigate to={homePathFor(user)} replace />;
  if (status === "loading" && hadSession()) return <FullPageLoader label="Verificando sessão" />;
  return <LandingPage />;
}
