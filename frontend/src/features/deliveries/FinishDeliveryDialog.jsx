import { CheckCheck } from "lucide-react";
import { useRef, useState } from "react";

import { api, toApiError } from "@/api/client";
import { splitApiError } from "@/api/formErrors";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Dialog } from "@/components/ui/Dialog/Dialog";
import { PhotoInput } from "@/components/ui/PhotoInput/PhotoInput";
import { SignaturePad } from "@/components/ui/SignaturePad/SignaturePad";
import { TextArea } from "@/components/ui/TextField/TextArea";
import { TextField } from "@/components/ui/TextField/TextField";
import { compressImage, uploadDeliveryFile } from "@/lib/image";
import { useOneShotLocation } from "@/lib/useOneShotLocation";
import { useQuery } from "@/lib/useQuery";

import styles from "./deliveries.module.css";
import { LocationHint } from "./LocationHint";

const NO_RULES = { require_recipient_name: false, require_photo: false, require_signature: false };

/**
 * Finalização com comprovante. basePath: "/me/deliveries" (entregador) ou
 * "/deliveries" (operador). As exigências configuradas pela empresa valem
 * para o entregador; o operador finaliza por exceção (fica na auditoria).
 */
export function FinishDeliveryDialog({ delivery, basePath, onClose, onDone }) {
  const enforce = basePath === "/me/deliveries";
  const location = useOneShotLocation();
  const { data: company } = useQuery(
    (signal) => api.get("/company", { signal }).then((r) => r.data),
    [],
  );
  const rules = enforce ? (company?.settings?.proof ?? NO_RULES) : NO_RULES;

  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [signed, setSigned] = useState(false);
  const signatureRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [stage, setStage] = useState(null); // texto do passo atual durante o envio

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const missing = {};
    if (rules.require_recipient_name && !receivedBy.trim()) {
      missing.received_by_name = "Informe quem recebeu.";
    }
    if (rules.require_photo && !photo) missing.photo = "A foto é obrigatória.";
    if (rules.require_signature && !signed) missing.signature = "A assinatura é obrigatória.";
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }

    try {
      // 1) arquivos primeiro; 2) finaliza. Se a rede cair no meio, nada é
      // finalizado sem comprovante — basta tentar de novo.
      if (photo) {
        setStage("Enviando foto…");
        const compressed = await compressImage(photo);
        await uploadDeliveryFile(api, basePath, delivery.id, "PROOF_PHOTO", compressed, "foto.jpg");
      }
      if (signed) {
        setStage("Enviando assinatura…");
        const blob = await signatureRef.current?.toBlob();
        if (blob) {
          await uploadDeliveryFile(
            api,
            basePath,
            delivery.id,
            "PROOF_SIGNATURE",
            blob,
            "assinatura.png",
          );
        }
      }
      setStage("Finalizando…");
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
      setStage(null);
    }
  }

  const saving = stage !== null;

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
        {stage && (
          <p className={styles.stage} aria-live="polite">
            {stage}
          </p>
        )}
        <TextField
          data-autofocus
          label="Quem recebeu"
          required={rules.require_recipient_name}
          size="lg"
          placeholder="Ex.: a própria cliente, porteiro João"
          autoComplete="off"
          value={receivedBy}
          onChange={(event) => setReceivedBy(event.target.value)}
          error={errors.received_by_name}
        />
        <PhotoInput
          label="Foto da entrega"
          required={rules.require_photo}
          value={photo}
          onChange={setPhoto}
          error={errors.photo}
          hint={rules.require_photo ? null : "Opcional. Ex.: pacote na portaria."}
        />
        <SignaturePad
          ref={signatureRef}
          label="Assinatura de quem recebeu"
          required={rules.require_signature}
          onChange={setSigned}
          error={errors.signature}
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
