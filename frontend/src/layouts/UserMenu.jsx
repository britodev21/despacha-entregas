import { ChevronDown, KeyRound, LogOut, MonitorSmartphone } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useAuth } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/auth/permissions";
import { ConfirmDialog } from "@/components/ui/Dialog/ConfirmDialog";
import { ThemeToggle } from "@/components/ui/ThemeToggle/ThemeToggle";
import { ChangePasswordDialog } from "@/features/account/ChangePasswordDialog";
import { cx } from "@/lib/cx";
import { formatPhone } from "@/lib/phone";

import styles from "./UserMenu.module.css";

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase();
}

/**
 * Menu do usuário com a Popover API nativa do navegador (atributo `popover`):
 * fechar ao clicar fora, fechar com Esc e camada por cima de tudo vêm de graça,
 * sem bibliotecas nem listeners manuais.
 */
// Celulares antigos (iOS 16 ou anterior, Chrome antes da versão 114) não têm a
// Popover API: lá o menu abre e fecha por estado do React.
const SUPPORTS_POPOVER =
  typeof HTMLElement !== "undefined" && Object.hasOwn(HTMLElement.prototype, "popover");

export function UserMenu({ compact = false, themeInMenu = false }) {
  const { user, logout, logoutAll } = useAuth();
  const menuId = useId();
  const [leaving, setLeaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Sem Popover API: fecha ao tocar fora e com Esc (o que o popover faz sozinho).
  useEffect(() => {
    if (SUPPORTS_POPOVER || !fallbackOpen) return undefined;
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setFallbackOpen(false);
    };
    const onKeyDown = (event) => event.key === "Escape" && setFallbackOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [fallbackOpen]);

  const closeMenu = () => {
    document.getElementById(menuId)?.hidePopover?.();
    setFallbackOpen(false);
  };

  const openChangePassword = () => {
    closeMenu();
    setChangingPassword(true);
  };

  const openLogoutAll = () => {
    closeMenu();
    setConfirmAll(true);
  };

  const handleLogoutAll = async () => {
    setLeaving(true);
    await logoutAll();
  };

  const handleLogout = async () => {
    setLeaving(true);
    await logout(); // o guard de rota leva para /login
  };

  return (
    <span ref={wrapperRef} className={styles.wrapper}>
      <button
        type="button"
        popoverTarget={SUPPORTS_POPOVER ? menuId : undefined}
        onClick={SUPPORTS_POPOVER ? undefined : () => setFallbackOpen((open) => !open)}
        aria-expanded={SUPPORTS_POPOVER ? undefined : fallbackOpen}
        aria-controls={SUPPORTS_POPOVER ? undefined : menuId}
        className={cx(styles.trigger, compact && styles.compact)}
        aria-label={`Menu da conta de ${user.name}`}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials(user.name)}
        </span>
        {!compact && (
          <span className={styles.identity}>
            <span className={styles.name}>{user.name}</span>
            <span className={styles.role}>{ROLE_LABELS[user.role]}</span>
          </span>
        )}
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </button>

      <div
        id={menuId}
        popover={SUPPORTS_POPOVER ? "auto" : undefined}
        hidden={SUPPORTS_POPOVER ? undefined : !fallbackOpen}
        className={cx(styles.menu, !SUPPORTS_POPOVER && styles.menuFallback)}
      >
        <div className={styles.menuHeader}>
          <p className={styles.name}>{user.name}</p>
          <p className={styles.meta}>{user.email ?? formatPhone(user.phone)}</p>
          <p className={styles.meta}>
            {ROLE_LABELS[user.role]} · {user.company_name}
          </p>
        </div>
        {themeInMenu && (
          <div className={styles.theme}>
            <span aria-hidden="true">Tema</span>
            <ThemeToggle />
          </div>
        )}
        <button type="button" className={styles.item} onClick={openChangePassword}>
          <KeyRound aria-hidden="true" />
          Alterar senha
        </button>
        <button type="button" className={styles.item} onClick={openLogoutAll}>
          <MonitorSmartphone aria-hidden="true" />
          Sair de todos os dispositivos
        </button>
        <button type="button" className={styles.item} onClick={handleLogout} disabled={leaving}>
          <LogOut aria-hidden="true" />
          {leaving ? "Saindo…" : "Sair"}
        </button>
      </div>

      {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} />}
      {confirmAll && (
        <ConfirmDialog
          open
          tone="primary"
          title="Sair de todos os dispositivos?"
          description="Use se perdeu o celular ou entrou em um computador de outra pessoa."
          confirmLabel="Sair de todos"
          loading={leaving}
          onCancel={() => setConfirmAll(false)}
          onConfirm={handleLogoutAll}
        >
          <p>
            Todas as sessões serão encerradas na hora, inclusive esta. Depois é só entrar de novo.
          </p>
        </ConfirmDialog>
      )}
    </span>
  );
}
