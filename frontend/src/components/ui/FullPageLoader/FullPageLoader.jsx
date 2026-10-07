import { Logo } from "@/components/brand/Logo";

import { Spinner } from "../Spinner/Spinner";
import styles from "./FullPageLoader.module.css";

/** Carregamento de tela inteira (ex.: verificando a sessão ao abrir o app). */
export function FullPageLoader({ label = "Carregando" }) {
  return (
    <div className={styles.loader}>
      <Logo showWordmark={false} size="lg" />
      <Spinner label={label} className={styles.spinner} />
    </div>
  );
}
