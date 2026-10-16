import { ChevronDown } from "lucide-react";

import styles from "./FaqList.module.css";

/**
 * Perguntas frequentes com <details>/<summary> nativos: abre/fecha com
 * teclado e leitor de tela sem JavaScript; o navegador ainda encontra o texto
 * escondido com Ctrl+F.
 */
export function FaqList({ items }) {
  return (
    <div className={styles.list}>
      {items.map(({ q, a }) => (
        <details key={q} className={styles.item}>
          <summary className={styles.question}>
            <span>{q}</span>
            <ChevronDown aria-hidden="true" className={styles.chevron} />
          </summary>
          <div className={styles.answer}>{typeof a === "string" ? <p>{a}</p> : a}</div>
        </details>
      ))}
    </div>
  );
}
