import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { cx } from "@/lib/cx";

import { ToastContext } from "./ToastContext";
import styles from "./Toast.module.css";

const DURATION_MS = 4500;

/**
 * Avisos rápidos de resultado ("Usuário criado"). Ficam numa região
 * aria-live: leitores de tela anunciam sem tirar o foco do usuário.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (tone, message) => {
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-2), { id, tone, message }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} aria-live="polite" aria-relevant="additions">
        {toasts.map(({ id, tone, message }) => {
          const Icon = tone === "success" ? CircleCheck : CircleAlert;
          return (
            <div key={id} className={cx(styles.toast, styles[tone])}>
              <Icon aria-hidden="true" className={styles.icon} />
              <p className={styles.message}>{message}</p>
              <button
                type="button"
                className={styles.close}
                onClick={() => dismiss(id)}
                aria-label="Fechar aviso"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
