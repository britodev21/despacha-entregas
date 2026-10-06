import { cx } from "@/lib/cx";

import styles from "./Card.module.css";

/**
 * Superfície que agrupa conteúdo relacionado.
 * title/description/actions são opcionais e formam o cabeçalho.
 */
export function Card({ title, description, actions, as: Tag = "section", className, children }) {
  const hasHeader = title || description || actions;
  return (
    <Tag className={cx(styles.card, className)}>
      {hasHeader && (
        <header className={styles.header}>
          <div className={styles.heading}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
