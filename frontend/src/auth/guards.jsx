import { ShieldOff } from "lucide-react";
import { Link, Navigate, Outlet, useLocation } from "react-router";

import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { FullPageLoader } from "@/components/ui/FullPageLoader/FullPageLoader";

import { useAuth } from "./AuthContext";
import { homePathFor } from "./permissions";

/**
 * Guards de rota. Melhoram a experiência (ninguém vê uma tela que vai falhar),
 * mas NÃO são segurança: a API recusa sozinha quem não tem permissão.
 */

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageLoader label="Verificando sessão" />;
  if (status === "anonymous") {
    // Guarda de onde veio para voltar após o login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequirePermission({ permission, children }) {
  const { hasPermission, user } = useAuth();
  if (!hasPermission(permission)) {
    return (
      <EmptyState
        icon={ShieldOff}
        tone="danger"
        title="Acesso não permitido"
        description="Seu perfil não tem acesso a esta área."
        actions={
          <Button as={Link} to={homePathFor(user)}>
            Ir para o início
          </Button>
        }
      />
    );
  }
  return children ?? <Outlet />;
}
