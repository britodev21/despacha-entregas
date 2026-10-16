import {
  Contact,
  History,
  LayoutDashboard,
  Map,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  Truck,
  UserCog,
  X,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router";

import { useAuth } from "@/auth/AuthContext";
import { PERMISSIONS } from "@/auth/permissions";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button/Button";
import { PageLoader } from "@/components/ui/PageLoader/PageLoader";
import { ThemeToggle } from "@/components/ui/ThemeToggle/ThemeToggle";
import { cx } from "@/lib/cx";
import { usePageTitle } from "@/lib/pageTitle";

import styles from "./AppLayout.module.css";
import { useSidebarCollapsed } from "./sidebarPreference";
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

function Navigation({ onNavigate, id }) {
  const { hasPermission } = useAuth();
  return (
    <nav aria-label="Principal" id={id}>
      <ul role="list" className={styles.navList}>
        {NAV_ITEMS.filter((item) => hasPermission(item.permission)).map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) => cx(styles.navLink, isActive && styles.active)}
            >
              <Icon aria-hidden="true" />
              {/* Recolhida, o rótulo vira balão (hover/foco) e segue como nome acessível. */}
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Título compacto no cabeçalho do desktop: aparece só quando o título grande
 * da página sai da tela (evita "Operação" repetido no topo). Um marcador
 * invisível no começo da área principal é observado; sem eventos de scroll.
 */
function useScrolledPastHeader(sentinelRef) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);
  return scrolled;
}

/**
 * Estrutura do painel (admin/operador).
 * ≥1024px: sidebar fixa que recolhe em "cortina" para um trilho de ícones
 * (escolha lembrada no navegador). Menor: gaveta com <dialog> nativo, que já
 * traz foco preso dentro dela, Esc para fechar e fundo inerte.
 */
export function AppLayout() {
  const { user } = useAuth();
  const drawerRef = useRef(null);
  const sentinelRef = useRef(null);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const title = usePageTitle();
  const scrolledPastHeader = useScrolledPastHeader(sentinelRef);

  const openDrawer = () => drawerRef.current?.showModal();
  const closeDrawer = () => drawerRef.current?.close();

  return (
    <div className={cx(styles.shell, collapsed && styles.shellCollapsed)}>
      <a href="#conteudo" className={styles.skipLink}>
        Pular para o conteúdo
      </a>

      <aside className={styles.sidebar} data-collapsed={collapsed || undefined}>
        <Logo showWordmark={!collapsed} className={styles.sidebarLogo} />
        <Navigation id="menu-lateral" />
        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.collapseButton}
            aria-expanded={!collapsed}
            aria-controls="menu-lateral"
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
            <span className={styles.navLabel}>{collapsed ? "Expandir menu" : "Recolher menu"}</span>
          </button>
          <p className={styles.company}>{user.company_name}</p>
        </div>
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
        <div ref={sentinelRef} className={styles.titleSentinel} aria-hidden="true" />
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
          {/* Topo da página: a marca. Depois de rolar para longe do título grande,
              o nome da tela toma o lugar dela (sem repetir o h1 logo abaixo). */}
          <div className={styles.topbarContext} data-scrolled={scrolledPastHeader || undefined}>
            <Logo size="sm" className={styles.topbarLogo} />
            {title && (
              // Repete o h1 da página (referência para leitores de tela), por
              // isso fica fora da árvore de acessibilidade.
              <p className={styles.topbarTitle} aria-hidden="true">
                {title}
              </p>
            )}
          </div>
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
