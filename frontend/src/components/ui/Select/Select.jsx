import { ChevronDown, CircleAlert } from "lucide-react";
import { useId } from "react";

import { cx } from "@/lib/cx";

import fieldStyles from "../TextField/TextField.module.css";
import styles from "./Select.module.css";

/**
 * <select> nativo estilizado. Nativo de propósito: no celular abre o seletor
 * do sistema, funciona com teclado e leitores de tela sem nenhum JS extra.
 *
 * options: [{ value, label }]
 */
export function Select({
  label,
  hint,
  error,
  options,
  id,
  className,
  hideLabel = false,
  ...props
}) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className={cx(fieldStyles.field, className)}>
      <label htmlFor={selectId} className={hideLabel ? "sr-only" : fieldStyles.label}>
        {label}
      </label>
      <div
        className={cx(
          fieldStyles.control,
          fieldStyles.md,
          styles.control,
          error && fieldStyles.invalid,
        )}
      >
        <select
          id={selectId}
          className={styles.select}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(hintId, errorId) || undefined}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </div>
      {hint && !error && (
        <p id={hintId} className={fieldStyles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={fieldStyles.error}>
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
