import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cx } from "@/lib/cx";

import styles from "./Alert.module.css";

const ICONS = { danger: CircleAlert, warning: TriangleAlert, success: CircleCheck, info: Info };

/**
 * Mensagem em destaque dentro da página.
 * tone="danger" usa role="alert": leitores de tela anunciam na hora.
 */
export function Alert({ tone = "info", title, children, className, ref, ...props }) {
  const Icon = ICONS[tone];
  return (
    <div
      ref={ref}
      role={tone === "danger" ? "alert" : "status"}
      className={cx(styles.alert, styles[tone], className)}
      {...props}
    >
      <Icon aria-hidden="true" className={styles.icon} />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
    </div>
  );
}
