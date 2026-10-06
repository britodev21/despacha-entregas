import { cx } from "@/lib/cx";

import styles from "./Spinner.module.css";

/**
 * Indicador de carregamento.
 * `label` é anunciado por leitores de tela. Passe label="" quando o texto
 * ao lado já explica o carregamento (o spinner vira só decoração).
 */
export function Spinner({ size = "md", label = "Carregando", className }) {
  const classes = cx(styles.spinner, styles[size], className);
  if (!label) return <span aria-hidden="true" className={classes} />;
  return (
    <span role="status" className={classes}>
      <span className="sr-only">{label}</span>
    </span>
  );
}
