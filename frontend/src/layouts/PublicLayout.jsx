import { Menu, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle/ThemeToggle";
import { DemoButton } from "@/features/landing/DemoButton";

import styles from "./PublicLayout.module.css";

const NAV = [
  { to: "/#funcionalidades", label: "Funcionalidades" },
  { to: "/#como-funciona", label: "Como funciona" },
  { to: "/#segmentos", label: "Para quem é" },
  { to: "/suporte", label: "Suporte" },
];

const YEAR = new Date().getFullYear();

/** Leva até a âncora (#secao) depois da navegação; o React Router não faz isso. */
function useHashScroll() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 });
      return;
    }
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash, pathname]);
}

/**
 * Estrutura das páginas públicas (apresentação, suporte, privacidade):
 * topo com navegação, menu de celular em <dialog> nativo (Esc fecha, foco
 * preso dentro, fundo inerte) e rodapé.
 */
export function PublicLayout({ children }) {
  const menuRef = useRef(null);
  useHashScroll();

  const openMenu = () => menuRef.current?.showModal();
  const closeMenu = () => menuRef.current?.close();

  return (
    <div className={styles.shell}>
      <a href="#conteudo" className={styles.skipLink}>
        Pular para o conteúdo
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label="DESPACHA, página inicial">
            <Logo size="sm" />
          </Link>

          <nav className={styles.nav} aria-label="Principal">
            {NAV.map((item) => {
              // Âncoras (/#secao) não são "a página atual": só rotas usam NavLink.
              const Item = item.to.includes("#") ? Link : NavLink;
              return (
                <Item key={item.to} to={item.to} className={styles.navLink}>
                  {item.label}
                </Item>
              );
            })}
          </nav>

          <div className={styles.headerActions}>
            <Button as={Link} to="/login" variant="ghost" className={styles.loginButton}>
              Entrar
            </Button>
            <DemoButton size="md" className={styles.headerDemo} />
            <Button
              variant="ghost"
              iconOnly
              aria-label="Abrir menu"
              aria-haspopup="dialog"
              className={styles.menuButton}
              onClick={openMenu}
            >
              <Menu aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <dialog ref={menuRef} className={styles.mobileMenu} aria-label="Menu">
        <div className={styles.mobileMenuHead}>
          <Logo size="sm" />
          <Button variant="ghost" iconOnly aria-label="Fechar menu" onClick={closeMenu}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <nav aria-label="Principal (celular)">
          <ul className={styles.mobileNav}>
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} onClick={closeMenu}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.mobileMenuActions}>
          <DemoButton />
          <Button as={Link} to="/login" variant="secondary" size="lg" onClick={closeMenu}>
            Entrar
          </Button>
        </div>
      </dialog>

      <main id="conteudo" tabIndex={-1} className={styles.main}>
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Logo size="sm" />
            <p>
              Gestão de entregas simples para pequenos negócios: do pedido à porta do cliente, com
              mapa ao vivo e comprovante.
            </p>
            <ThemeToggle />
          </div>
          <nav className={styles.footerCols} aria-label="Rodapé">
            <div>
              <h2>Produto</h2>
              <ul>
                <li>
                  <Link to="/#funcionalidades">Funcionalidades</Link>
                </li>
                <li>
                  <Link to="/#como-funciona">Como funciona</Link>
                </li>
                <li>
                  <Link to="/#segmentos">Para quem é</Link>
                </li>
                <li>
                  <Link to="/login">Entrar</Link>
                </li>
              </ul>
            </div>
            <div>
              <h2>Suporte</h2>
              <ul>
                <li>
                  <Link to="/suporte">Central de ajuda</Link>
                </li>
                <li>
                  <Link to="/suporte#guias">Guias por perfil</Link>
                </li>
                <li>
                  <Link to="/suporte#perguntas">Perguntas frequentes</Link>
                </li>
              </ul>
            </div>
            <div>
              <h2>Legal</h2>
              <ul>
                <li>
                  <Link to="/privacidade">Privacidade e LGPD</Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <p className={styles.copyright}>© {YEAR} DESPACHA · Feito no Brasil</p>
      </footer>
    </div>
  );
}
