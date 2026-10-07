import { cx } from "@/lib/cx";

import styles from "./EmptyState.module.css";

/**
 * Estado vazio / mensagem: explica o que aconteceu e o que fazer agora.
 * Usado em listas sem resultados, erros de página e 404.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  tone = "neutral",
  className,
}) {
  return (
    <div className={cx(styles.empty, className)}>
      {Icon && (
        <span className={cx(styles.iconWrap, styles[tone])}>
          <Icon aria-hidden="true" className={styles.icon} />
        </span>
      )}
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
