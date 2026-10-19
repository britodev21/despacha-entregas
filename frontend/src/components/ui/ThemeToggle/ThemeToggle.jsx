import { Monitor, Moon, Sun } from "lucide-react";

import { cx } from "@/lib/cx";
import { useTheme } from "@/theme/ThemeContext";

import styles from "./ThemeToggle.module.css";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

/**
 * Seletor de tema com botões simples (aria-pressed). Botões em vez de rádios
 * invisíveis sobrepostos: alguns navegadores de celular não repassavam o
 * toque ao rádio dentro do menu do entregador.
 */
export function ThemeToggle({ showLabels = false, className }) {
  const { preference, setPreference } = useTheme();

  return (
    <div role="group" aria-label="Tema" className={cx(styles.group, className)}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className={styles.option}
          title={label}
          aria-pressed={preference === value}
          onClick={() => setPreference(value)}
        >
          <Icon aria-hidden="true" className={styles.icon} />
          <span className={showLabels ? styles.label : "sr-only"}>{label}</span>
        </button>
      ))}
    </div>
  );
}
