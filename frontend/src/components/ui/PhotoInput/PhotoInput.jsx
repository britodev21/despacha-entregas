import { Camera, X } from "lucide-react";
import { useEffect, useId, useMemo } from "react";

import { cx } from "@/lib/cx";

import styles from "./PhotoInput.module.css";

/**
 * Campo de foto: no celular abre a câmera traseira (capture="environment").
 * Mostra a prévia e permite refazer. `value` é um File/Blob ou null.
 */
export function PhotoInput({ label, required = false, value, onChange, error, hint }) {
  const id = useId();
  // Endereço temporário da prévia, liberado quando a foto muda ou sai da tela.
  const preview = useMemo(
    () => (value && typeof URL.createObjectURL === "function" ? URL.createObjectURL(value) : null),
    [value],
  );
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label}
        {required && <span className={styles.required}> (obrigatória)</span>}
      </span>

      {value ? (
        <div className={styles.previewWrap}>
          {preview && <img src={preview} alt="Prévia da foto" className={styles.preview} />}
          <button
            type="button"
            className={styles.remove}
            onClick={() => onChange(null)}
            aria-label="Remover foto"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label htmlFor={id} className={cx(styles.pick, error && styles.pickError)}>
          <Camera aria-hidden="true" />
          Tirar foto
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = ""; // permite escolher a mesma foto de novo
        }}
      />
      {hint && !error && <p className={styles.hint}>{hint}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
