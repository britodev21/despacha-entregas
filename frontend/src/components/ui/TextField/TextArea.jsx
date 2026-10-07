import { CircleAlert } from "lucide-react";
import { useId } from "react";

import { cx } from "@/lib/cx";

import styles from "./TextField.module.css";

/** Texto longo (observações, motivo de cancelamento). Mesmo visual do TextField. */
export function TextArea({
  label,
  hint,
  error,
  id,
  required = false,
  rows = 3,
  className,
  ...props
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
      <div className={cx(styles.control, styles.multiline, error && styles.invalid)}>
        <textarea
          id={inputId}
          rows={rows}
          required={required}
          className={cx(styles.input, styles.textarea)}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(hintId, errorId) || undefined}
          {...props}
        />
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
