import { X } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";

import { cx } from "@/lib/cx";

import { Button } from "../Button/Button";
import styles from "./Dialog.module.css";

/**
 * Janela sobreposta usando o elemento <dialog> nativo com showModal().
 * O navegador entrega de graça: foco preso dentro, Esc fecha, fundo inerte
 * (leitores de tela e Tab ignoram o resto da página) e devolução do foco ao
 * botão que abriu.
 *
 * variant: "modal" (centro) | "drawer" (painel lateral, bom para formulários)
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  variant = "modal",
  size = "md",
  dismissible = true,
  children,
}) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Se o componente sair da tela aberto, fecha antes: close() faz o navegador
  // devolver o foco ao elemento que abriu o diálogo.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const handleCancel = (event) => {
    // Esc: o pai decide (ex.: não fechar enquanto salva).
    event.preventDefault();
    if (dismissible) onClose();
  };

  const handleClick = (event) => {
    // Clique no fundo escurecido: o alvo é o próprio <dialog>.
    if (event.target === ref.current && dismissible) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[variant], styles[size])}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClick={handleClick}
    >
      {open && (
        <div className={styles.surface}>
          <header className={styles.header}>
            <div className={styles.heading}>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <Button variant="ghost" size="sm" iconOnly aria-label="Fechar" onClick={onClose}>
                <X aria-hidden="true" />
              </Button>
            )}
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
