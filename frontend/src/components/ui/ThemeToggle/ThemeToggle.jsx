import { Monitor, Moon, Sun } from "lucide-react";
import { useId } from "react";

import { cx } from "@/lib/cx";
import { useTheme } from "@/theme/ThemeContext";

import styles from "./ThemeToggle.module.css";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

/**
 * Seletor de tema com rádios nativos estilizados: navegação por setas,
 * leitores de tela e foco funcionam sem JavaScript extra.
 */
export function ThemeToggle({ showLabels = false, className }) {
  const { preference, setPreference } = useTheme();
  const name = useId();

  return (
    <fieldset className={cx(styles.group, className)}>
      <legend className="sr-only">Tema</legend>
      {OPTIONS.map(({ value, label, Icon }) => (
        <label key={value} className={styles.option} title={label}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={preference === value}
            onChange={() => setPreference(value)}
            className={styles.input}
          />
          <Icon aria-hidden="true" className={styles.icon} />
          <span className={showLabels ? styles.label : "sr-only"}>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
