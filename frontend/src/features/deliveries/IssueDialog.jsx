import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { splitApiError } from "@/api/formErrors";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Dialog } from "@/components/ui/Dialog/Dialog";
import { TextArea } from "@/components/ui/TextField/TextArea";
import { cx } from "@/lib/cx";

import { useOneShotLocation } from "@/lib/useOneShotLocation";

import { LocationHint } from "./LocationHint";
import { OCCURRENCE_TYPES } from "./occurrences";
import styles from "./deliveries.module.css";

/** Registro de ocorrência: tipo (toque grande) + descrição opcional. */
export function IssueDialog({ delivery, basePath, onClose, onDone }) {
  const location = useOneShotLocation();
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    if (!type) {
      setFormError("Escolha o que aconteceu.");
      return;
    }
    if (type === "OTHER" && !description.trim()) {
      setErrors({ description: "Descreva o que aconteceu." });
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post(`${basePath}/${delivery.id}/issues`, {
        type,
        description,
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
      title="Registrar ocorrência"
      description={`#${delivery.number} · ${delivery.recipient_name}`}
      footer={
        <Button
          type="submit"
          form="issue-form"
          size="xl"
          variant="danger"
          fullWidth
          loading={saving}
        >
          Registrar ocorrência
        </Button>
      }
    >
      <form id="issue-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <fieldset className={styles.issueTypes}>
          <legend className="sr-only">O que aconteceu?</legend>
          {OCCURRENCE_TYPES.map(({ value, label, Icon }) => (
            <label
              key={value}
              className={cx(styles.issueType, type === value && styles.issueTypeSelected)}
            >
              <input
                type="radio"
                name="issue-type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              <Icon aria-hidden="true" />
              {label}
            </label>
          ))}
        </fieldset>
        <TextArea
          label="Detalhes"
          rows={2}
          required={type === "OTHER"}
          placeholder={type === "OTHER" ? "Descreva o que aconteceu" : "Opcional"}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={errors.description}
        />
        <LocationHint location={location} />
      </form>
    </Dialog>
  );
}
