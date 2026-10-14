import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cx } from "@/lib/cx";

import styles from "./StatTile.module.css";

/**
 * Número de destaque (KPI). Contrato: rótulo (sem dois-pontos), valor,
 * delta opcional contra um período NOMEADO e ícone que identifica o tipo.
 *
 * tone: cor do ícone (status/brand). O texto fica sempre nas cores de texto:
 * a cor acompanha o ícone, nunca carrega sozinha a informação.
 * emphasis: destaca o card inteiro (ex.: ocorrências > 0).
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "brand",
  delta,
  hint,
  emphasis = false,
}) {
  return (
    <div className={cx(styles.tile, emphasis && styles.emphasis)}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {Icon && (
          <span className={cx(styles.icon, styles[tone])}>
            <Icon aria-hidden="true" />
          </span>
        )}
      </div>
      <span className={styles.value}>{value}</span>
      {delta && <Delta {...delta} />}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

/** delta: { value: número, label: "vs. ontem até agora", upIsGood: true } */
function Delta({ value, label, upIsGood = true }) {
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const good = direction === "flat" ? null : (direction === "up") === upIsGood;
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  return (
    <span className={cx(styles.delta, good === true && styles.good, good === false && styles.bad)}>
      <Icon aria-hidden="true" />
      {value > 0 ? `+${value}` : value} {label}
    </span>
  );
}
