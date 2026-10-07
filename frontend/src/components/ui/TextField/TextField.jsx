import { CircleAlert } from "lucide-react";
import { useId } from "react";

import { cx } from "@/lib/cx";

import styles from "./TextField.module.css";

/**
 * Campo de texto com label sempre visível (placeholder não substitui label),
 * dica e mensagem de erro ligadas ao input via aria-describedby: leitores de
 * tela anunciam o erro junto com o campo.
 *
 * `ref` chega como prop comum (React 19) e vai direto para o <input>.
 */
export function TextField({
  label,
  hint,
  error,
  id,
  required = false,
  size = "md",
  endAdornment = null,
  className,
  ref,
  ...inputProps
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className={cx(styles.control, styles[size], error && styles.invalid)}>
        <input
          ref={ref}
          id={inputId}
          className={styles.input}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(hintId, errorId) || undefined}
          {...inputProps}
        />
        {endAdornment && <div className={styles.adornment}>{endAdornment}</div>}
      </div>

      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
