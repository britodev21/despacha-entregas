import { LocateFixed, LocateOff } from "lucide-react";

import styles from "./deliveries.module.css";

/** Mostra se a localização do celular será enviada junto. */
export function LocationHint({ location }) {
  if (location.status === "loading")
    return <p className={styles.locationHint}>Obtendo localização…</p>;
  if (location.status === "ok") {
    return (
      <p className={styles.locationHint}>
        <LocateFixed aria-hidden="true" /> Localização registrada junto.
      </p>
    );
  }
  return (
    <p className={styles.locationHint}>
      <LocateOff aria-hidden="true" /> Sem localização (permissão negada ou GPS indisponível).
    </p>
  );
}
