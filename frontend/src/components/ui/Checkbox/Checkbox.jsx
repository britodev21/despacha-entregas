import { Check } from "lucide-react";
import { useId } from "react";

import { cx } from "@/lib/cx";

import styles from "./Checkbox.module.css";

/** Checkbox nativo estilizado; a área clicável inclui o texto. */
export function Checkbox({ label, hint, className, id, ...props }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <label htmlFor={inputId} className={cx(styles.wrapper, className)}>
      <span className={styles.box}>
        <input
          id={inputId}
          type="checkbox"
          className={styles.input}
          aria-describedby={hintId}
          {...props}
        />
        <Check aria-hidden="true" className={styles.check} />
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
