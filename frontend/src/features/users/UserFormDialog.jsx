import { WandSparkles } from "lucide-react";
import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { splitApiError } from "@/api/formErrors";
import { ROLE_LABELS } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Dialog } from "@/components/ui/Dialog/Dialog";
import { Select } from "@/components/ui/Select/Select";
import { TextField } from "@/components/ui/TextField/TextField";
import { generatePassword } from "@/lib/password";
import { formatPhone } from "@/lib/phone";

import styles from "./UsersPage.module.css";

const ROLE_HINTS = {
  ADMIN: "Acesso total, inclusive usuários, auditoria e configurações.",
  OPERATOR: "Cadastra clientes e entregas, distribui e acompanha a operação.",
  DELIVERER: "Vê e atualiza apenas as próprias entregas, pelo celular.",
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

/**
 * Cria ou edita um usuário. Sem `user` = criação (pede senha inicial).
 * Montado só quando aberto (o Dialog renderiza o conteúdo condicionalmente),
 * então o estado do formulário sempre começa limpo.
 */
export function UserFormDialog({ open, user, onClose, onSaved }) {
  const editing = Boolean(user);
  const [values, setValues] = useState(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: formatPhone(user?.phone),
    role: user?.role ?? "DELIVERER",
    password: "",
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (event) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);

    const payload = {
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      role: values.role,
    };
    try {
      const { data } = editing
        ? await api.patch(`/users/${user.id}`, payload)
        : await api.post("/users", { ...payload, password: values.password });
      onSaved(data, editing ? "Alterações salvas." : `${data.name} foi cadastrado(a).`);
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
      open={open}
      onClose={onClose}
      variant="drawer"
      dismissible={!saving}
      title={editing ? "Editar usuário" : "Novo usuário"}
      description={
        editing ? user.name : "Informe e-mail ou telefone: é com ele que a pessoa vai entrar."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            {editing ? "Salvar alterações" : "Cadastrar usuário"}
          </Button>
        </>
      }
    >
      <form id="user-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <TextField
          label="Nome"
          required
          value={values.name}
          onChange={set("name")}
          error={errors.name}
          autoComplete="off"
        />
        <TextField
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={values.email}
          onChange={set("email")}
          error={errors.email}
        />
        <TextField
          label="Telefone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(11) 98765-4321"
          hint="Com DDD. Entregadores costumam entrar pelo telefone."
          value={values.phone}
          onChange={set("phone")}
          error={errors.phone}
        />
        <Select
          label="Perfil"
          options={ROLE_OPTIONS}
          value={values.role}
          onChange={set("role")}
          hint={ROLE_HINTS[values.role]}
          error={errors.role}
        />

        {!editing && (
          <div className={styles.passwordRow}>
            <TextField
              label="Senha inicial"
              required
              autoComplete="new-password"
              hint="Mínimo de 10 caracteres. Repasse à pessoa por um canal seguro."
              value={values.password}
              onChange={set("password")}
              error={errors.password}
              className={styles.passwordField}
            />
            <Button
              variant="secondary"
              iconLeft={<WandSparkles aria-hidden="true" />}
              onClick={() => setValues((current) => ({ ...current, password: generatePassword() }))}
              className={styles.generate}
            >
              Gerar
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  );
}
