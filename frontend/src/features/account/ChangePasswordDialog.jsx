import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { splitApiError } from "@/api/formErrors";
import { useAuth } from "@/auth/AuthContext";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Dialog } from "@/components/ui/Dialog/Dialog";
import { PasswordField } from "@/components/ui/TextField/PasswordField";
import { useToast } from "@/components/ui/Toast/ToastContext";

import styles from "./ChangePasswordDialog.module.css";

/** Troca da própria senha. Encerra as outras sessões; a atual continua. */
export function ChangePasswordDialog({ onClose }) {
  const { applySession } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ current_password: "", new_password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (event) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    if (values.new_password !== values.confirm) {
      setErrors({ confirm: "As senhas não conferem." });
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/auth/change-password", {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      applySession(data); // novo access token: os antigos deixaram de valer
      toast.success("Senha alterada. Outras sessões foram encerradas.");
      onClose();
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
      dismissible={!saving}
      size="sm"
      title="Alterar senha"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="change-password-form" loading={saving}>
            Alterar senha
          </Button>
        </>
      }
    >
      <form id="change-password-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <PasswordField
          label="Senha atual"
          autoComplete="current-password"
          value={values.current_password}
          onChange={set("current_password")}
          error={errors.current_password}
        />
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          hint="Mínimo de 10 caracteres."
          value={values.new_password}
          onChange={set("new_password")}
          error={errors.new_password}
        />
        <PasswordField
          label="Confirme a nova senha"
          autoComplete="new-password"
          value={values.confirm}
          onChange={set("confirm")}
          error={errors.confirm}
        />
      </form>
    </Dialog>
  );
}
