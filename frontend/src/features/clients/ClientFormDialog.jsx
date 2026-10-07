import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { splitApiError } from "@/api/formErrors";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { Dialog } from "@/components/ui/Dialog/Dialog";
import { TextField } from "@/components/ui/TextField/TextField";
import { formatDocument } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

import { AddressFields } from "./AddressFields";
import { EMPTY_ADDRESS } from "./addressForm";
import styles from "./clients.module.css";

/** Separa erros "addresses.0.street" para o bloco de endereço. */
function splitAddressErrors(fields) {
  const client = {};
  const address = {};
  for (const [key, message] of Object.entries(fields)) {
    const match = key.match(/^addresses\.0\.(.+)$/);
    if (match) address[match[1]] = message;
    else client[key] = message;
  }
  return { client, address };
}

/**
 * Cria (com endereço opcional, no mesmo passo) ou edita os dados do cliente.
 * Endereços de um cliente existente são editados na tela de detalhe.
 */
export function ClientFormDialog({ client, onClose, onSaved }) {
  const editing = Boolean(client);
  const [values, setValues] = useState({
    name: client?.name ?? "",
    phone: formatPhone(client?.phone),
    email: client?.email ?? "",
    document: formatDocument(client?.document),
    notes: client?.notes ?? "",
  });
  const [withAddress, setWithAddress] = useState(!editing);
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS, is_default: true });
  const [errors, setErrors] = useState({ client: {}, address: {} });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const field = (name) => ({
    value: values[name],
    onChange: (event) => setValues((current) => ({ ...current, [name]: event.target.value })),
    error: errors.client[name],
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({ client: {}, address: {} });
    setFormError(null);
    try {
      const { data } = editing
        ? await api.patch(`/clients/${client.id}`, values)
        : await api.post("/clients", { ...values, addresses: withAddress ? [address] : [] });
      onSaved(data, editing ? "Dados do cliente salvos." : `${data.name} foi cadastrado(a).`);
    } catch (error) {
      const { fields, form } = splitApiError(toApiError(error));
      setErrors(splitAddressErrors(fields));
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
      title={editing ? "Editar cliente" : "Novo cliente"}
      description={editing ? client.name : "Só o nome é obrigatório."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="client-form" loading={saving}>
            {editing ? "Salvar" : "Cadastrar cliente"}
          </Button>
        </>
      }
    >
      <form id="client-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <TextField data-autofocus label="Nome" required autoComplete="off" {...field("name")} />
        <TextField
          label="Telefone"
          type="tel"
          inputMode="tel"
          placeholder="(11) 98765-4321"
          autoComplete="off"
          {...field("phone")}
        />
        <TextField
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="off"
          {...field("email")}
        />
        <TextField
          label="CPF ou CNPJ"
          inputMode="numeric"
          hint="Opcional. Só se a operação realmente precisar."
          autoComplete="off"
          {...field("document")}
        />
        <TextField label="Observações" autoComplete="off" {...field("notes")} />

        {!editing && (
          <section className={styles.section}>
            <Checkbox
              label="Cadastrar endereço agora"
              checked={withAddress}
              onChange={(event) => setWithAddress(event.target.checked)}
            />
            {withAddress && (
              <AddressFields
                values={address}
                errors={errors.address}
                showDefaultToggle={false}
                onChange={(name, value) => setAddress((current) => ({ ...current, [name]: value }))}
              />
            )}
          </section>
        )}
      </form>
    </Dialog>
  );
}
