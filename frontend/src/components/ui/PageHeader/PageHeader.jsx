import styles from "./PageHeader.module.css";

/** Cabeçalho de página: onde estou (título), o que é (descrição), o que posso fazer (ações). */
export function PageHeader({ title, description, actions }) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
