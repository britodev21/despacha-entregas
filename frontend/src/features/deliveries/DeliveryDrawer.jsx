import {
  Ban,
  CheckCheck,
  ExternalLink,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  TriangleAlert,
  UserMinus,
  UserRoundCheck,
} from "lucide-react";
import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { AuthorizedImage } from "@/components/ui/AuthorizedImage/AuthorizedImage";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { ConfirmDialog } from "@/components/ui/Dialog/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog/Dialog";
import { Select } from "@/components/ui/Select/Select";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { TextArea } from "@/components/ui/TextField/TextArea";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { cx } from "@/lib/cx";
import { formatZip } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatMoment } from "@/lib/time";
import { useQuery } from "@/lib/useQuery";

import { DELIVERY_STATUS } from "./deliveryStatus";
import { FinishDeliveryDialog } from "./FinishDeliveryDialog";
import { IssueDialog } from "./IssueDialog";
import { OCCURRENCE_LABELS } from "./occurrences";
import { isFinal, isLate, mapsUrl, paymentSummary, streetLine } from "./deliveryHelpers";
import styles from "./deliveries.module.css";

function Timeline({ delivery }) {
  const steps = [
    { label: "Criada", at: delivery.created_at },
    {
      label: delivery.deliverer ? `Atribuída a ${delivery.deliverer.name}` : "Atribuída",
      at: delivery.assigned_at,
    },
    { label: "Saiu para entrega", at: delivery.started_at },
    delivery.status === "CANCELED"
      ? { label: "Cancelada", at: delivery.canceled_at, tone: "danger" }
      : { label: "Entregue", at: delivery.delivered_at, tone: "success" },
  ];
  return (
    <ol className={styles.timeline}>
      {steps.map((step) => (
        <li
          key={step.label}
          className={cx(
            styles.timelineStep,
            step.at && styles.timelineDone,
            step.at && styles[step.tone],
          )}
        >
          <span className={styles.timelineDot} aria-hidden="true" />
          <span className={styles.timelineLabel}>{step.label}</span>
          <span className={styles.timelineTime}>
            {step.at ? <time dateTime={step.at}>{formatMoment(step.at)}</time> : "—"}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Detalhe de uma entrega com as ações possíveis no status atual.
 * As regras de verdade estão no backend (máquina de estados); aqui só
 * mostramos os botões que fazem sentido.
 */
export function DeliveryDrawer({ deliveryId, onClose, onChanged, onEdit }) {
  const toast = useToast();
  const {
    data: delivery,
    error,
    loading,
    reload,
  } = useQuery(
    (signal) => api.get(`/deliveries/${deliveryId}`, { signal }).then((r) => r.data),
    [deliveryId],
  );
  const [busy, setBusy] = useState(null); // nome da ação em andamento
  const [delivererId, setDelivererId] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [sheet, setSheet] = useState(null); // "finish" | "issue"
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(null);

  const status = delivery?.status;
  const canAssign = ["PENDING", "ASSIGNED", "ISSUE"].includes(status);

  const { data: deliverers } = useQuery(
    (signal) =>
      canAssign ? api.get("/deliverers", { signal }).then((r) => r.data) : Promise.resolve([]),
    [canAssign],
  );

  async function act(action, body, message) {
    setBusy(action);
    try {
      const { data } = await api.post(`/deliveries/${deliveryId}/${action}`, body);
      toast.success(message(data));
      reload();
      onChanged();
      return true;
    } catch (err) {
      toast.error(toApiError(err).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function confirmCancel() {
    if (reason.trim().length < 3) {
      setReasonError("Informe o motivo (mínimo 3 caracteres).");
      return;
    }
    const ok = await act(
      "cancel",
      { reason: reason.trim() },
      (d) => `Entrega #${d.number} cancelada.`,
    );
    if (ok) setCanceling(false);
  }

  const view = delivery && DELIVERY_STATUS[delivery.status];

  return (
    <Dialog
      open
      onClose={onClose}
      variant="drawer"
      title={delivery ? `Entrega #${delivery.number}` : "Entrega"}
      description={delivery?.recipient_name}
    >
      {loading && !delivery && (
        <div className={styles.drawerLoading}>
          <Spinner label="Carregando entrega" />
        </div>
      )}
      {error && <Alert tone="danger">{error.message}</Alert>}

      {delivery && (
        <div className={styles.detail}>
          <div className={styles.detailStatus}>
            <Badge tone={view.tone} icon={<view.Icon aria-hidden="true" />}>
              {view.label}
            </Badge>
            {isLate(delivery) && <Badge tone="warning">Atrasada</Badge>}
            {delivery.expected_at && !isFinal(delivery) && (
              <span className={styles.muted}>Previsão {formatMoment(delivery.expected_at)}</span>
            )}
          </div>

          {/* ---------- Ações do status atual ---------- */}
          {!isFinal(delivery) && (
            <section className={styles.actions} aria-label="Ações">
              {canAssign && (
                <div className={styles.assignRow}>
                  <Select
                    label={delivery.deliverer ? "Trocar entregador" : "Entregador"}
                    options={[
                      { value: "", label: "Escolha…" },
                      ...(deliverers ?? [])
                        .filter((d) => d.id !== delivery.deliverer?.id)
                        .map((d) => ({
                          value: d.id,
                          label: `${d.name} · ${d.active_deliveries ? `${d.active_deliveries} em andamento` : "livre"}`,
                        })),
                    ]}
                    value={delivererId}
                    onChange={(e) => setDelivererId(e.target.value)}
                    className={styles.assignSelect}
                  />
                  <Button
                    iconLeft={<UserRoundCheck aria-hidden="true" />}
                    disabled={!delivererId}
                    loading={busy === "assign"}
                    onClick={async () => {
                      const ok = await act(
                        "assign",
                        { deliverer_id: delivererId },
                        (d) => `Entrega #${d.number} atribuída a ${d.deliverer.name}.`,
                      );
                      if (ok) setDelivererId("");
                    }}
                    className={styles.assignButton}
                  >
                    Atribuir
                  </Button>
                </div>
              )}

              <div className={styles.actionButtons}>
                {(status === "ASSIGNED" || status === "ISSUE") && delivery.deliverer && (
                  <Button
                    iconLeft={<Navigation aria-hidden="true" />}
                    loading={busy === "start"}
                    onClick={() => act("start", null, (d) => `Entrega #${d.number} em rota.`)}
                  >
                    {status === "ISSUE" ? "Retomar rota" : "Iniciar rota"}
                  </Button>
                )}
                {(status === "IN_ROUTE" || status === "ISSUE") && (
                  <Button
                    iconLeft={<CheckCheck aria-hidden="true" />}
                    onClick={() => setSheet("finish")}
                  >
                    Marcar como entregue
                  </Button>
                )}
                {status === "IN_ROUTE" && (
                  <Button
                    variant="secondary"
                    iconLeft={<TriangleAlert aria-hidden="true" />}
                    onClick={() => setSheet("issue")}
                  >
                    Registrar ocorrência
                  </Button>
                )}
                {status === "ASSIGNED" && (
                  <Button
                    variant="secondary"
                    iconLeft={<UserMinus aria-hidden="true" />}
                    loading={busy === "unassign"}
                    onClick={() =>
                      act("unassign", null, (d) => `Entrega #${d.number} voltou para pendentes.`)
                    }
                  >
                    Desatribuir
                  </Button>
                )}
                <Button
                  variant="secondary"
                  iconLeft={<Pencil aria-hidden="true" />}
                  onClick={() => onEdit(delivery)}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  iconLeft={<Ban aria-hidden="true" />}
                  onClick={() => {
                    setReason("");
                    setReasonError(null);
                    setCanceling(true);
                  }}
                >
                  Cancelar entrega
                </Button>
              </div>
            </section>
          )}

          {delivery.status === "CANCELED" && delivery.cancel_reason && (
            <Alert tone="danger" title="Motivo do cancelamento">
              {delivery.cancel_reason}
            </Alert>
          )}

          {/* ---------- Destino ---------- */}
          <section className={styles.block}>
            <h3 className={styles.blockTitle}>Destino</h3>
            <p className={styles.strong}>{streetLine(delivery)}</p>
            <p className={styles.muted}>
              {delivery.neighborhood} · {delivery.city}/{delivery.state}
              {delivery.zip_code && ` · CEP ${formatZip(delivery.zip_code)}`}
            </p>
            {delivery.reference && (
              <p className={styles.reference}>
                <MapPin aria-hidden="true" />
                {delivery.reference}
              </p>
            )}
            <div className={styles.linkRow}>
              <a
                href={mapsUrl(delivery)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                <ExternalLink aria-hidden="true" />
                Abrir no mapa
              </a>
              {delivery.recipient_phone && (
                <a href={`tel:+${delivery.recipient_phone}`} className={styles.link}>
                  <Phone aria-hidden="true" />
                  {formatPhone(delivery.recipient_phone)}
                </a>
              )}
            </div>
          </section>

          {/* ---------- Pagamento ---------- */}
          {(delivery.order_amount || delivery.payment_method || delivery.delivery_fee) && (
            <section className={styles.block}>
              <h3 className={styles.blockTitle}>Pagamento</h3>
              <dl className={styles.facts}>
                {delivery.order_amount && (
                  <>
                    <dt>Valor do pedido</dt>
                    <dd className="tabular">{formatMoney(delivery.order_amount)}</dd>
                  </>
                )}
                {delivery.delivery_fee && (
                  <>
                    <dt>Taxa de entrega</dt>
                    <dd className="tabular">{formatMoney(delivery.delivery_fee)}</dd>
                  </>
                )}
                {delivery.payment_method && (
                  <>
                    <dt>Forma</dt>
                    <dd>{paymentSummary(delivery)}</dd>
                  </>
                )}
              </dl>
            </section>
          )}

          {delivery.occurrences.length > 0 && (
            <section className={styles.block}>
              <h3 className={styles.blockTitle}>Ocorrências</h3>
              <ul className={styles.eventList}>
                {delivery.occurrences.map((occurrence) => (
                  <li key={occurrence.id} className={styles.eventItem}>
                    <span className={styles.eventHeading}>
                      {OCCURRENCE_LABELS[occurrence.type]}
                      <time dateTime={occurrence.created_at} className={styles.muted}>
                        {formatMoment(occurrence.created_at)}
                      </time>
                    </span>
                    {occurrence.description && <span>{occurrence.description}</span>}
                    {occurrence.reporter && (
                      <span className={styles.muted}>
                        Registrada por {occurrence.reporter.name}
                      </span>
                    )}
                    {delivery.files
                      .filter((file) => file.occurrence_id === occurrence.id)
                      .map((file) => (
                        <AuthorizedImage key={file.id} src={file.url} alt="Foto da ocorrência" />
                      ))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {delivery.proof && (
            <section className={styles.block}>
              <h3 className={styles.blockTitle}>Comprovante</h3>
              <dl className={styles.facts}>
                <dt>Recebido por</dt>
                <dd>{delivery.proof.received_by_name ?? "Não informado"}</dd>
                {delivery.proof.notes && (
                  <>
                    <dt>Observação</dt>
                    <dd>{delivery.proof.notes}</dd>
                  </>
                )}
                <dt>Local</dt>
                <dd>
                  {delivery.proof.lat ? (
                    <a
                      href={`https://www.google.com/maps?q=${delivery.proof.lat},${delivery.proof.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver no mapa
                    </a>
                  ) : (
                    "Sem localização"
                  )}
                </dd>
              </dl>
              {delivery.files.some((file) => !file.occurrence_id) && (
                <div className={styles.thumbs}>
                  {delivery.files
                    .filter((file) => !file.occurrence_id)
                    .map((file) => (
                      <div key={file.id}>
                        <span className={styles.thumbLabel}>
                          {file.kind === "PROOF_SIGNATURE" ? "Assinatura" : "Foto"}
                        </span>
                        <AuthorizedImage
                          src={file.url}
                          alt={
                            file.kind === "PROOF_SIGNATURE"
                              ? "Assinatura de quem recebeu"
                              : "Foto da entrega"
                          }
                        />
                      </div>
                    ))}
                </div>
              )}
            </section>
          )}

          {delivery.notes && (
            <section className={styles.block}>
              <h3 className={styles.blockTitle}>Observações</h3>
              <p className={styles.notes}>{delivery.notes}</p>
            </section>
          )}

          {/* ---------- Linha do tempo ---------- */}
          <section className={styles.block}>
            <h3 className={styles.blockTitle}>Linha do tempo</h3>
            <Timeline delivery={delivery} />
          </section>
        </div>
      )}

      {sheet === "finish" && delivery && (
        <FinishDeliveryDialog
          delivery={delivery}
          basePath="/deliveries"
          onClose={() => setSheet(null)}
          onDone={(data) => {
            setSheet(null);
            toast.success(`Entrega #${data.number} entregue.`);
            reload();
            onChanged();
          }}
        />
      )}
      {sheet === "issue" && delivery && (
        <IssueDialog
          delivery={delivery}
          basePath="/deliveries"
          onClose={() => setSheet(null)}
          onDone={(data) => {
            setSheet(null);
            toast.success(`Ocorrência registrada na entrega #${data.number}.`);
            reload();
            onChanged();
          }}
        />
      )}
      {canceling && delivery && (
        <ConfirmDialog
          open
          title={`Cancelar entrega #${delivery.number}?`}
          description="O entregador deixa de ver esta entrega. Essa ação não pode ser desfeita."
          confirmLabel="Cancelar entrega"
          loading={busy === "cancel"}
          onCancel={() => setCanceling(false)}
          onConfirm={confirmCancel}
        >
          <TextArea
            data-autofocus
            label="Motivo"
            required
            rows={2}
            placeholder="Ex.: cliente desistiu do pedido"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(null);
            }}
            error={reasonError}
          />
        </ConfirmDialog>
      )}
    </Dialog>
  );
}
