import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { useId, useState } from "react";

import { useAuth } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/auth/permissions";
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
export function UserMenu({ compact = false }) {
  const { user, logout } = useAuth();
  const menuId = useId();
  const [leaving, setLeaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const openChangePassword = () => {
    document.getElementById(menuId)?.hidePopover();
    setChangingPassword(true);
  };

  const handleLogout = async () => {
    setLeaving(true);
    await logout(); // o guard de rota leva para /login
  };

  return (
    <>
      <button
        type="button"
        popoverTarget={menuId}
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

      <div id={menuId} popover="auto" className={styles.menu}>
        <div className={styles.menuHeader}>
          <p className={styles.name}>{user.name}</p>
          <p className={styles.meta}>{user.email ?? formatPhone(user.phone)}</p>
          <p className={styles.meta}>
            {ROLE_LABELS[user.role]} · {user.company_name}
          </p>
        </div>
        <button type="button" className={styles.item} onClick={openChangePassword}>
          <KeyRound aria-hidden="true" />
          Alterar senha
        </button>
        <button type="button" className={styles.item} onClick={handleLogout} disabled={leaving}>
          <LogOut aria-hidden="true" />
          {leaving ? "Saindo…" : "Sair"}
        </button>
      </div>

      {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} />}
    </>
  );
}
