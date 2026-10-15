import {
  Contact,
  History,
  LayoutDashboard,
  Map,
  Menu,
  ScrollText,
  Settings,
  Truck,
  UserCog,
  X,
} from "lucide-react";
import { Suspense, useRef } from "react";
import { NavLink, Outlet } from "react-router";

import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/auth/permissions";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button/Button";
import { PageLoader } from "@/components/ui/PageLoader/PageLoader";
import { ThemeToggle } from "@/components/ui/ThemeToggle/ThemeToggle";
import { cx } from "@/lib/cx";

import styles from "./AppLayout.module.css";
import { UserMenu } from "./UserMenu";

// Só aparece no menu o que o perfil pode acessar (e o que já existe).
const NAV_ITEMS = [
  { to: "/painel", label: "Painel", Icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_READ },
  { to: "/entregas", label: "Operação", Icon: Truck, permission: PERMISSIONS.DELIVERIES_MANAGE },
  { to: "/mapa", label: "Mapa", Icon: Map, permission: PERMISSIONS.TRACKING_READ },
  {
    to: "/historico",
    label: "Histórico",
    Icon: History,
    permission: PERMISSIONS.DELIVERIES_MANAGE,
  },
  { to: "/clientes", label: "Clientes", Icon: Contact, permission: PERMISSIONS.CLIENTS_MANAGE },
  { to: "/usuarios", label: "Usuários", Icon: UserCog, permission: PERMISSIONS.USERS_MANAGE },
  { to: "/auditoria", label: "Auditoria", Icon: ScrollText, permission: PERMISSIONS.AUDIT_READ },
  {
    to: "/configuracoes",
    label: "Configurações",
    Icon: Settings,
    permission: PERMISSIONS.SETTINGS_MANAGE,
  },
];

function Navigation({ onNavigate }) {
  const { hasPermission } = useAuth();
  return (
    <nav aria-label="Principal">
      <ul role="list" className={styles.navList}>
        {NAV_ITEMS.filter((item) => hasPermission(item.permission)).map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) => cx(styles.navLink, isActive && styles.active)}
            >
              <Icon aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Estrutura do painel (admin/operador).
 * ≥1024px: sidebar fixa. Menor: gaveta com <dialog> nativo, que já traz
 * foco preso dentro dela, Esc para fechar e fundo inerte (acessibilidade).
 */
export function AppLayout() {
  const { user } = useAuth();
  const drawerRef = useRef(null);

  const openDrawer = () => drawerRef.current?.showModal();
  const closeDrawer = () => drawerRef.current?.close();

  return (
    <div className={styles.shell}>
      <a href="#conteudo" className={styles.skipLink}>
        Pular para o conteúdo
      </a>

      <aside className={styles.sidebar}>
        <Logo className={styles.sidebarLogo} />
        <Navigation />
        <p className={styles.company}>{user.company_name}</p>
      </aside>

      <dialog
        ref={drawerRef}
        className={styles.drawer}
        aria-label="Menu"
        // Clique no fundo escurecido (fora do conteúdo) fecha a gaveta.
        onClick={(event) => event.target === drawerRef.current && closeDrawer()}
      >
        <div className={styles.drawerInner}>
          <div className={styles.drawerHeader}>
            <Logo />
            <Button variant="ghost" iconOnly aria-label="Fechar menu" onClick={closeDrawer}>
              <X aria-hidden="true" />
            </Button>
          </div>
          <Navigation onNavigate={closeDrawer} />
          <div className={styles.drawerFooter}>
            {/* No celular o tema fica aqui: no topo não cabe junto com o menu da conta. */}
            <div className={styles.drawerTheme}>
              <span aria-hidden="true">Tema</span>
              <ThemeToggle />
            </div>
            <p className={styles.company}>{user.company_name}</p>
          </div>
        </div>
      </dialog>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <Button
            variant="ghost"
            iconOnly
            aria-label="Abrir menu"
            className={styles.menuButton}
            onClick={openDrawer}
          >
            <Menu aria-hidden="true" />
          </Button>
          <Logo size="sm" className={styles.topbarLogo} />
          <div className={styles.topbarActions}>
            <ThemeToggle className={styles.topbarTheme} />
            <UserMenu />
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className={styles.content}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
