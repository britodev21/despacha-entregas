import { WandSparkles } from "lucide-react";
import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { splitApiError } from "@/api/formErrors";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Dialog } from "@/components/ui/Dialog/Dialog";
import { TextField } from "@/components/ui/TextField/TextField";
import { generatePassword } from "@/lib/password";

import styles from "./UsersPage.module.css";

/** Admin define uma senha nova (substitui o "esqueci minha senha" no MVP). */
export function ResetPasswordDialog({ open, user, onClose, onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFormError(null);
    try {
      await api.post(`/users/${user.id}/reset-password`, { new_password: password });
      onDone(`Senha de ${user.name} redefinida.`);
    } catch (err) {
      const { fields, form } = splitApiError(toApiError(err));
      setError(fields.new_password ?? null);
      setFormError(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Redefinir senha"
      description={user?.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="reset-password-form" loading={saving}>
            Redefinir senha
          </Button>
        </>
      }
    >
      <form id="reset-password-form" className={styles.form} onSubmit={handleSubmit} noValidate>
        <Alert tone="info">
          Todas as sessões dessa pessoa serão encerradas, e a conta será desbloqueada se estiver
          bloqueada.
        </Alert>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className={styles.passwordRow}>
          <TextField
            label="Nova senha"
            required
            autoComplete="new-password"
            hint="Mínimo de 10 caracteres."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error}
            className={styles.passwordField}
          />
          <Button
            variant="secondary"
            iconLeft={<WandSparkles aria-hidden="true" />}
            onClick={() => setPassword(generatePassword())}
            className={styles.generate}
          >
            Gerar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
