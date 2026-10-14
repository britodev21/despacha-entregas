import { Spinner } from "../Spinner/Spinner";
import styles from "./PageLoader.module.css";

/** Carregamento de uma página dentro do layout (ex.: módulo carregado sob demanda). */
export function PageLoader({ label = "Carregando" }) {
  return (
    <div className={styles.loader}>
      <Spinner size="lg" label={label} />
    </div>
  );
}
