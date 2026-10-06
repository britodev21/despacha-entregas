import { cx } from "@/lib/cx";

import { Spinner } from "../Spinner/Spinner";
import styles from "./Button.module.css";

/**
 * Botão base do design system.
 *
 * variant: "primary" | "secondary" | "ghost" | "danger"
 * size:    "sm" | "md" | "lg" | "xl"  (lg/xl para toque — área do entregador)
 * loading: mostra spinner, mantém a largura e bloqueia cliques repetidos.
 * iconOnly: exige `aria-label`, já que não há texto visível.
 * as:      renderiza outro elemento com o mesmo visual, ex.: <Button as={Link} to="/">.
 */
export function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  iconOnly = false,
  iconLeft = null,
  iconRight = null,
  type,
  className,
  onClick,
  children,
  ...props
}) {
  const handleClick = (event) => {
    // aria-disabled em vez de disabled durante loading: o botão continua
    // focável (o foco do teclado não "some"), mas o clique é ignorado.
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  // type="button" por padrão: evita submit acidental quando dentro de um <form>.
  const isNativeButton = Component === "button";

  return (
    <Component
      type={isNativeButton ? (type ?? "button") : undefined}
      className={cx(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        iconOnly && styles.iconOnly,
        loading && styles.loading,
        className,
      )}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      <span className={styles.content}>
        {iconLeft}
        {children}
        {iconRight}
      </span>
      {loading && <Spinner size="sm" className={styles.spinner} label="Processando" />}
    </Component>
  );
}
