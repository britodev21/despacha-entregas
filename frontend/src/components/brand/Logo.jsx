import { cx } from "@/lib/cx";

import styles from "./Logo.module.css";

/** Marca do DESPACHA. Sem o nome visível, o SVG ganha um rótulo acessível. */
export function Logo({ size = "md", showWordmark = true, className }) {
  return (
    <span className={cx(styles.logo, styles[size], className)}>
      <svg
        viewBox="0 0 32 32"
        className={styles.mark}
        role={showWordmark ? undefined : "img"}
        aria-hidden={showWordmark || undefined}
        aria-label={showWordmark ? undefined : "DESPACHA"}
      >
        <rect width="32" height="32" rx="8" fill="#0284c7" />
        <path
          d="M10 9.5h5.5a6.5 6.5 0 0 1 0 13H10z"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="24" r="3.5" fill="#fb923c" />
      </svg>
      {showWordmark && <span className={styles.wordmark}>DESPACHA</span>}
    </span>
  );
}
