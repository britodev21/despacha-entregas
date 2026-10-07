import { Button } from "../Button/Button";
import { Dialog } from "./Dialog";

/**
 * Confirmação para ações destrutivas ou difíceis de desfazer.
 * O botão de confirmação diz exatamente o que vai acontecer
 * ("Desativar usuário", nunca só "OK").
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
  children,
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Voltar
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
