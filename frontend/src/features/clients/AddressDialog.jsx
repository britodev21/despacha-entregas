import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { splitApiError } from "@/api/formErrors";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Dialog } from "@/components/ui/Dialog/Dialog";

import { AddressFields } from "./AddressFields";
import { addressToForm } from "./addressForm";
import styles from "./clients.module.css";

/** Adiciona ou edita um endereço do cliente. */
export function AddressDialog({ clientId, address, onClose, onSaved }) {
  const editing = Boolean(address);
  const [values, setValues] = useState(() => addressToForm(address));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const base = `/clients/${clientId}/addresses`;
      if (editing) await api.patch(`${base}/${address.id}`, values);
      else await api.post(base, values);
      onSaved(editing ? "Endereço atualizado." : "Endereço adicionado.");
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
      title={editing ? "Editar endereço" : "Novo endereço"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="address-form" loading={saving}>
            {editing ? "Salvar endereço" : "Adicionar endereço"}
          </Button>
        </>
      }
    >
      <form id="address-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <AddressFields
          values={values}
          errors={errors}
          onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
        />
      </form>
    </Dialog>
  );
}
