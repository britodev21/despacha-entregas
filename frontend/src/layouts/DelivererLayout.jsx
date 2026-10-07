import { Outlet } from "react-router";

import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle/ThemeToggle";

import styles from "./DelivererLayout.module.css";
import { UserMenu } from "./UserMenu";

/**
 * Estrutura da área do entregador: pensada para celular, uma mão, na rua.
 * Sem menu lateral: tudo o que importa fica na própria tela.
 */
export function DelivererLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Logo size="sm" />
        <div className={styles.actions}>
          <ThemeToggle />
          <UserMenu compact />
        </div>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
