import { Clock, MapPin, UserRound, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/Badge/Badge";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/money";
import { formatElapsed } from "@/lib/time";

import { isLate, paymentSummary, streetLine } from "./deliveryHelpers";
import styles from "./deliveries.module.css";

/**
 * Cartão do quadro de operação. Mostra só o que ajuda a decidir rápido:
 * quem, onde, quanto cobrar, com quem está e há quanto tempo.
 */
export function DeliveryCard({ delivery, now, onOpen }) {
  const late = isLate(delivery, now);
  const payment = paymentSummary(delivery);

  return (
    <button
      type="button"
      className={cx(styles.card, late && styles.cardLate)}
      onClick={() => onOpen(delivery.id)}
      aria-label={`Entrega ${delivery.number}, ${delivery.recipient_name}`}
    >
      <span className={styles.cardTop}>
        <span className={styles.cardNumber}>#{delivery.number}</span>
        <span className={styles.cardElapsed}>
          <Clock aria-hidden="true" />
          <time dateTime={delivery.created_at}>{formatElapsed(delivery.created_at, now)}</time>
        </span>
      </span>

      <span className={styles.cardRecipient}>{delivery.recipient_name}</span>

      <span className={styles.cardLine}>
        <MapPin aria-hidden="true" />
        <span>
          {streetLine(delivery)} · {delivery.neighborhood}
        </span>
      </span>

      {(payment || delivery.order_amount) && (
        <span className={styles.cardLine}>
          <Wallet aria-hidden="true" />
          <span>
            {delivery.order_amount && <strong>{formatMoney(delivery.order_amount)}</strong>}
            {delivery.order_amount && payment && " · "}
            {payment}
          </span>
        </span>
      )}

      <span className={styles.cardFooter}>
        {delivery.deliverer ? (
          <span className={styles.cardLine}>
            <UserRound aria-hidden="true" />
            {delivery.deliverer.name}
          </span>
        ) : (
          <span className={styles.cardUnassigned}>Sem entregador</span>
        )}
        {late && <Badge tone="warning">Atrasada</Badge>}
      </span>
    </button>
  );
}
