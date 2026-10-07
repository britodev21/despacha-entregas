import styles from "./Skeleton.module.css";

/** Bloco cinza pulsante no lugar do conteúdo que ainda está carregando. */
export function Skeleton({ width = "100%", height = "1rem" }) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" />;
}
