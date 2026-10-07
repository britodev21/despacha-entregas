import { MapPinPlus, X } from "lucide-react";
import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { splitApiError } from "@/api/formErrors";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Dialog } from "@/components/ui/Dialog/Dialog";
import { Select } from "@/components/ui/Select/Select";
import { TextArea } from "@/components/ui/TextField/TextArea";
import { TextField } from "@/components/ui/TextField/TextField";
import { AddressDialog } from "@/features/clients/AddressDialog";
import { cx } from "@/lib/cx";
import { formatAreaLine, formatStreetLine } from "@/lib/format";
import { moneyToInput, parseMoney, PAYMENT_METHODS } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatMoment, minutesFromNow } from "@/lib/time";
import { useQuery } from "@/lib/useQuery";

import { ClientPicker } from "./ClientPicker";
import styles from "./deliveries.module.css";

const ADDRESS_EDITABLE = new Set(["PENDING", "ASSIGNED", "ISSUE"]);
const ETA_OPTIONS = [
  { value: "", label: "Sem previsão" },
  { value: "20", label: "Em 20 minutos" },
  { value: "30", label: "Em 30 minutos" },
  { value: "45", label: "Em 45 minutos" },
  { value: "60", label: "Em 1 hora" },
  { value: "90", label: "Em 1h30" },
];
const PAYMENT_OPTIONS = [{ value: "", label: "Não informado" }, ...PAYMENT_METHODS];

function initialValues(delivery) {
  return {
    addressId: delivery?.client_address_id ?? "",
    order_amount: moneyToInput(delivery?.order_amount),
    payment_method: delivery?.payment_method ?? "",
    change_for: moneyToInput(delivery?.change_for),
    delivery_fee: moneyToInput(delivery?.delivery_fee),
    eta: delivery?.expected_at ? "keep" : "",
    notes: delivery?.notes ?? "",
    deliverer_id: "",
  };
}

/**
 * Nova entrega ou edição. Pensado para o balcão: um formulário só, sem
 * etapas escondidas; cliente e endereço primeiro, detalhes depois.
 */
export function DeliveryFormDialog({ delivery, onClose, onSaved }) {
  const editing = Boolean(delivery);
  const [clientId, setClientId] = useState(delivery?.client_id ?? null);
  const [values, setValues] = useState(() => initialValues(delivery));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);

  const addressLocked = editing && !ADDRESS_EDITABLE.has(delivery.status);

  const clientQuery = useQuery(
    (signal) =>
      clientId && !addressLocked
        ? api.get(`/clients/${clientId}`, { signal }).then((response) => response.data)
        : Promise.resolve(null),
    [clientId, addressLocked],
  );
  const client = clientQuery.data;

  const { data: deliverers } = useQuery(
    (signal) =>
      editing
        ? Promise.resolve([])
        : api.get("/deliverers", { signal }).then((response) => response.data),
    [editing],
  );

  // Seleciona o endereço principal assim que o cliente carrega.
  const addresses = client?.addresses ?? [];
  const selectedAddress =
    values.addressId || addresses.find((a) => a.is_default)?.id || addresses[0]?.id || "";

  const set = (name) => (event) =>
    setValues((current) => ({ ...current, [name]: event.target.value }));

  function pickClient(id) {
    setClientId(id);
    setValues((current) => ({ ...current, addressId: "" }));
    setErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    // Valores em reais digitados → decimais para a API.
    const money = {};
    const moneyErrors = {};
    for (const field of ["order_amount", "change_for", "delivery_fee"]) {
      const parsed = parseMoney(values[field]);
      if (parsed === undefined) moneyErrors[field] = "Valor inválido. Ex.: 58,90";
      else money[field] = parsed;
    }
    if (!editing && !clientId) moneyErrors.client = "Escolha o cliente.";
    if (!addressLocked && !selectedAddress)
      moneyErrors.addressId = "Escolha o endereço de entrega.";
    if (Object.keys(moneyErrors).length) {
      setErrors(moneyErrors);
      return;
    }

    const payload = {
      ...money,
      payment_method: values.payment_method || null,
      change_for: values.payment_method === "CASH" ? money.change_for : null,
      notes: values.notes,
    };
    if (values.eta !== "keep")
      payload.expected_at = values.eta ? minutesFromNow(Number(values.eta)) : null;
    if (!addressLocked) payload.client_address_id = selectedAddress;

    setSaving(true);
    try {
      const { data } = editing
        ? await api.patch(`/deliveries/${delivery.id}`, payload)
        : await api.post("/deliveries", {
            ...payload,
            client_id: clientId,
            deliverer_id: values.deliverer_id || null,
          });
      onSaved(
        data,
        editing ? `Entrega #${data.number} atualizada.` : `Entrega #${data.number} criada.`,
      );
    } catch (error) {
      const { fields, form } = splitApiError(toApiError(error));
      setErrors({ ...fields, addressId: fields.client_address_id });
      setFormError(form);
    } finally {
      setSaving(false);
    }
  }

  const delivererOptions = [
    { value: "", label: "Atribuir depois" },
    ...(deliverers ?? []).map((d) => ({
      value: d.id,
      label: d.active_deliveries
        ? `${d.name} · ${d.active_deliveries} em andamento`
        : `${d.name} · livre`,
    })),
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      variant="drawer"
      dismissible={!saving}
      title={editing ? `Editar entrega #${delivery.number}` : "Nova entrega"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="delivery-form" loading={saving}>
            {editing ? "Salvar alterações" : "Criar entrega"}
          </Button>
        </>
      }
    >
      {/* O cliente fica FORA do <form>: o cadastro rápido de cliente abre outro
          formulário, e form dentro de form faria o "enviar" de um disparar o outro. */}
      <div className={styles.form}>
        {formError && <Alert tone="danger">{formError}</Alert>}

        {/* ---------- Cliente ---------- */}
        {!clientId ? (
          <>
            <ClientPicker onSelect={pickClient} />
            {errors.client && <Alert tone="danger">{errors.client}</Alert>}
          </>
        ) : (
          <div className={styles.selectedClient}>
            <div>
              <p className={styles.selectedName}>{client?.name ?? delivery?.recipient_name}</p>
              <p className={styles.muted}>
                {formatPhone(client?.phone ?? delivery?.recipient_phone)}
              </p>
            </div>
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<X aria-hidden="true" />}
                onClick={() => pickClient(null)}
              >
                Trocar
              </Button>
            )}
          </div>
        )}

        <form id="delivery-form" className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* ---------- Endereço ---------- */}
          {clientId && !addressLocked && (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Endereço de entrega</legend>
              {clientQuery.loading && !client ? (
                <p className={styles.muted}>Carregando endereços…</p>
              ) : addresses.length === 0 ? (
                <Alert tone="warning">Este cliente ainda não tem endereço.</Alert>
              ) : (
                <div className={styles.addressOptions} role="radiogroup">
                  {addresses.map((address) => (
                    <label
                      key={address.id}
                      className={cx(
                        styles.addressOption,
                        selectedAddress === address.id && styles.addressOptionSelected,
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={address.id}
                        checked={selectedAddress === address.id}
                        onChange={() =>
                          setValues((current) => ({ ...current, addressId: address.id }))
                        }
                        className={styles.radio}
                      />
                      <span>
                        <span className={styles.addressOptionTitle}>
                          {address.label || formatStreetLine(address)}
                        </span>
                        <span className={styles.muted}>
                          {address.label && `${formatStreetLine(address)} · `}
                          {formatAreaLine(address)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {errors.addressId && <p className={styles.fieldError}>{errors.addressId}</p>}
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<MapPinPlus aria-hidden="true" />}
                onClick={() => setAddingAddress(true)}
                className={styles.inlineAction}
              >
                Novo endereço
              </Button>
            </fieldset>
          )}
          {addressLocked && (
            <Alert tone="info">A entrega já saiu: o endereço não pode mais ser alterado.</Alert>
          )}

          {/* ---------- Pagamento ---------- */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Pagamento</legend>
            <div className={styles.twoCols}>
              <TextField
                label="Valor do pedido"
                inputMode="decimal"
                placeholder="0,00"
                value={values.order_amount}
                onChange={set("order_amount")}
                error={errors.order_amount}
              />
              <TextField
                label="Taxa de entrega"
                inputMode="decimal"
                placeholder="0,00"
                value={values.delivery_fee}
                onChange={set("delivery_fee")}
                error={errors.delivery_fee}
              />
              <Select
                label="Forma de pagamento"
                options={PAYMENT_OPTIONS}
                value={values.payment_method}
                onChange={set("payment_method")}
                error={errors.payment_method}
              />
              {values.payment_method === "CASH" && (
                <TextField
                  label="Troco para"
                  inputMode="decimal"
                  placeholder="0,00"
                  hint="Deixe vazio se não precisar."
                  value={values.change_for}
                  onChange={set("change_for")}
                  error={errors.change_for}
                />
              )}
            </div>
          </fieldset>

          {/* ---------- Operação ---------- */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Entrega</legend>
            <div className={styles.twoCols}>
              <Select
                label="Previsão"
                options={
                  values.eta === "keep" || delivery?.expected_at
                    ? [
                        { value: "keep", label: `Manter (${formatMoment(delivery.expected_at)})` },
                        ...ETA_OPTIONS,
                      ]
                    : ETA_OPTIONS
                }
                value={values.eta}
                onChange={set("eta")}
              />
              {!editing && (
                <Select
                  label="Entregador"
                  options={delivererOptions}
                  value={values.deliverer_id}
                  onChange={set("deliverer_id")}
                />
              )}
            </div>
            <TextArea
              label="Observações"
              placeholder="Ex.: tocar o interfone 12, pedido com bebida gelada"
              value={values.notes}
              onChange={set("notes")}
              error={errors.notes}
            />
          </fieldset>
        </form>
      </div>

      {addingAddress && client && (
        <AddressDialog
          clientId={client.id}
          onClose={() => setAddingAddress(false)}
          onSaved={() => {
            setAddingAddress(false);
            clientQuery.reload();
          }}
        />
      )}
    </Dialog>
  );
}
