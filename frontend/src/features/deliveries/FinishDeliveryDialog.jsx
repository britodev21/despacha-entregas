import { CheckCheck } from "lucide-react";
import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { splitApiError } from "@/api/formErrors";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Dialog } from "@/components/ui/Dialog/Dialog";
import { TextArea } from "@/components/ui/TextField/TextArea";
import { TextField } from "@/components/ui/TextField/TextField";
import { useOneShotLocation } from "@/lib/useOneShotLocation";

import styles from "./deliveries.module.css";
import { LocationHint } from "./LocationHint";

/**
 * Finalização com comprovante simples. basePath: "/me/deliveries" (entregador)
 * ou "/deliveries" (operador).
 */
export function FinishDeliveryDialog({ delivery, basePath, onClose, onDone }) {
  const location = useOneShotLocation();
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const { data } = await api.post(`${basePath}/${delivery.id}/complete`, {
        received_by_name: receivedBy,
        notes,
        ...(location.coords ?? {}),
      });
      onDone(data);
    } catch (error) {
      const { fields, form } = splitApiError(toApiError(error));
      setErrors(fields);
      setFormError(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      variant="drawer"
      dismissible={!saving}
      title="Finalizar entrega"
      description={`#${delivery.number} · ${delivery.recipient_name}`}
      footer={
        <Button
          type="submit"
          form="finish-form"
          size="xl"
          fullWidth
          loading={saving}
          iconLeft={<CheckCheck aria-hidden="true" />}
        >
          Confirmar entrega
        </Button>
      }
    >
      <form id="finish-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <TextField
          data-autofocus
          label="Quem recebeu"
          size="lg"
          placeholder="Ex.: a própria cliente, porteiro João"
          autoComplete="off"
          value={receivedBy}
          onChange={(event) => setReceivedBy(event.target.value)}
          error={errors.received_by_name}
        />
        <TextArea
          label="Observação"
          rows={2}
          placeholder="Opcional"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          error={errors.notes}
        />
        <LocationHint location={location} />
      </form>
    </Dialog>
  );
}
