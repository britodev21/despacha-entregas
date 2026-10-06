import { cx } from "@/lib/cx";

import styles from "./Badge.module.css";

/**
 * Rótulo curto de estado.
 *
 * tone: "neutral" | "brand" | "success" | "warning" | "danger"
 *       ou um status de entrega: "pending" | "assigned" | "inRoute" |
 *       "delivered" | "canceled" | "issue"
 *
 * Cor nunca é a única pista: sempre há texto, e de preferência um ícone.
 */
export function Badge({ tone = "neutral", icon = null, className, children }) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
