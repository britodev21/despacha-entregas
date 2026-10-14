import {
  ArrowLeft,
  CheckCheck,
  MapPin,
  Navigation,
  NotebookText,
  Phone,
  Play,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { api, toApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
  collectInstructions,
  isFinal,
  mapsUrl,
  streetLine,
  wazeUrl,
} from "@/features/deliveries/deliveryHelpers";
import { DELIVERY_STATUS } from "@/features/deliveries/deliveryStatus";
import { FinishDeliveryDialog } from "@/features/deliveries/FinishDeliveryDialog";
import { IssueDialog } from "@/features/deliveries/IssueDialog";
import { OCCURRENCE_LABELS } from "@/features/deliveries/occurrences";
import { useTracking } from "@/features/tracking/TrackingContext";
import { formatZip } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { formatMoment } from "@/lib/time";
import { useQuery } from "@/lib/useQuery";

import styles from "./deliverer.module.css";

const BASE = "/me/deliveries";

/**
 * Uma entrega, tela inteira, pensada para uma mão:
 * endereço grande → abrir navegação → ligar → ação principal fixa embaixo.
 */
export function DelivererDeliveryPage() {
  const { deliveryId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const tracking = useTracking();
  const {
    data: delivery,
    error,
    loading,
    reload,
  } = useQuery(
    (signal) => api.get(`${BASE}/${deliveryId}`, { signal }).then((r) => r.data),
    [deliveryId],
  );
  const [dialog, setDialog] = useState(null); // "finish" | "issue"
  const [starting, setStarting] = useState(false);

  if (loading && !delivery) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" label="Carregando entrega" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={TriangleAlert}
        tone="danger"
        title={error.status === 404 ? "Entrega não encontrada" : "Não foi possível carregar"}
        description={
          error.status === 404 ? "Ela pode ter sido reatribuída ou cancelada." : error.message
        }
        actions={
          <Button as={Link} to="/entregador">
            Voltar para minhas entregas
          </Button>
        }
      />
    );
  }

  const view = DELIVERY_STATUS[delivery.status];
  const collect = collectInstructions(delivery);
  const lastIssue = delivery.occurrences.at(-1);

  async function start() {
    setStarting(true);
    try {
      await api.post(`${BASE}/${delivery.id}/start`);
      tracking.refresh(); // em rota: liga o compartilhamento de localização já
      toast.success(
        delivery.status === "ISSUE" ? "Entrega retomada." : "Boa entrega! Status: em rota.",
      );
      reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className={styles.detail}>
      <Link to="/entregador" className={styles.back}>
        <ArrowLeft aria-hidden="true" />
        Minhas entregas
      </Link>

      <header className={styles.detailHeader}>
        <Badge tone={view.tone} icon={<view.Icon aria-hidden="true" />}>
          {view.label}
        </Badge>
        <span className={styles.rowNumber}>#{delivery.number}</span>
      </header>

      <h1 className={styles.recipient}>{delivery.recipient_name}</h1>

      {/* ---------- Onde ---------- */}
      <section className={styles.addressBlock}>
        <p className={styles.street}>{streetLine(delivery)}</p>
        <p className={styles.area}>
          {delivery.neighborhood} · {delivery.city}/{delivery.state}
          {delivery.zip_code && ` · ${formatZip(delivery.zip_code)}`}
        </p>
        {delivery.reference && (
          <p className={styles.reference}>
            <MapPin aria-hidden="true" />
            {delivery.reference}
          </p>
        )}
      </section>

      {!isFinal(delivery) && (
        <div className={styles.navButtons}>
          <Button
            as="a"
            href={mapsUrl(delivery)}
            target="_blank"
            rel="noopener noreferrer"
            size="xl"
            fullWidth
            iconLeft={<Navigation aria-hidden="true" />}
          >
            Abrir no Google Maps
          </Button>
          <div className={styles.navSecondary}>
            <Button
              as="a"
              href={wazeUrl(delivery)}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="lg"
              fullWidth
            >
              Waze
            </Button>
            {delivery.recipient_phone && (
              <Button
                as="a"
                href={`tel:+${delivery.recipient_phone}`}
                variant="secondary"
                size="lg"
                fullWidth
                iconLeft={<Phone aria-hidden="true" />}
              >
                Ligar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ---------- Cobrança ---------- */}
      {collect && !isFinal(delivery) && (
        <Alert tone={collect.tone === "success" ? "success" : "warning"} title="Pagamento">
          <span className={styles.collect}>
            <Wallet aria-hidden="true" />
            {collect.text}
          </span>
        </Alert>
      )}

      {delivery.notes && (
        <section className={styles.notesBlock}>
          <h2 className={styles.blockTitle}>
            <NotebookText aria-hidden="true" />
            Observações
          </h2>
          <p className={styles.notes}>{delivery.notes}</p>
        </section>
      )}

      {delivery.status === "ISSUE" && lastIssue && (
        <Alert tone="danger" title={`Ocorrência: ${OCCURRENCE_LABELS[lastIssue.type]}`}>
          {lastIssue.description ?? "Aguardando orientação do operador."} Se resolver, retome a
          entrega.
        </Alert>
      )}

      {delivery.status === "DELIVERED" && (
        <Alert tone="success" title={`Entregue ${formatMoment(delivery.delivered_at)}`}>
          {delivery.proof?.received_by_name
            ? `Recebido por ${delivery.proof.received_by_name}.`
            : "Entrega confirmada."}
        </Alert>
      )}
      {delivery.status === "CANCELED" && (
        <Alert tone="danger" title="Entrega cancelada">
          {delivery.cancel_reason}
        </Alert>
      )}

      {delivery.recipient_phone && isFinal(delivery) && (
        <p className={styles.muted}>Telefone: {formatPhone(delivery.recipient_phone)}</p>
      )}

      {/* ---------- Ação principal: barra fixa embaixo, ao alcance do polegar ---------- */}
      {!isFinal(delivery) && (
        <div className={styles.actionBar}>
          {(delivery.status === "ASSIGNED" || delivery.status === "ISSUE") && (
            <Button
              size="xl"
              fullWidth
              loading={starting}
              iconLeft={<Play aria-hidden="true" />}
              onClick={start}
            >
              {delivery.status === "ISSUE" ? "Retomar entrega" : "Iniciar entrega"}
            </Button>
          )}
          {delivery.status === "IN_ROUTE" && (
            <>
              <Button
                size="xl"
                fullWidth
                iconLeft={<CheckCheck aria-hidden="true" />}
                onClick={() => setDialog("finish")}
              >
                Finalizar entrega
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                iconLeft={<TriangleAlert aria-hidden="true" />}
                onClick={() => setDialog("issue")}
              >
                Registrar ocorrência
              </Button>
            </>
          )}
        </div>
      )}

      {dialog === "finish" && (
        <FinishDeliveryDialog
          delivery={delivery}
          basePath={BASE}
          onClose={() => setDialog(null)}
          onDone={(data) => {
            setDialog(null);
            tracking.refresh();
            toast.success(`Entrega #${data.number} finalizada!`);
            navigate("/entregador");
          }}
        />
      )}
      {dialog === "issue" && (
        <IssueDialog
          delivery={delivery}
          basePath={BASE}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            toast.success("Ocorrência registrada. O operador foi avisado no painel.");
            reload();
          }}
        />
      )}
    </div>
  );
}
