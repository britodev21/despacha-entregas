import { Save } from "lucide-react";
import { useState } from "react";

import { api, toApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";
import { PageLoader } from "@/components/ui/PageLoader/PageLoader";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { useQuery } from "@/lib/useQuery";

import styles from "./SettingsPage.module.css";

const PROOF_OPTIONS = [
  {
    key: "require_recipient_name",
    label: "Exigir o nome de quem recebeu",
    hint: "Ex.: “a própria cliente”, “porteiro João”.",
  },
  {
    key: "require_photo",
    label: "Exigir foto da entrega",
    hint: "Foto do pacote entregue ou do local. Útil para farmácias e encomendas de valor.",
  },
  {
    key: "require_signature",
    label: "Exigir assinatura",
    hint: "Quem recebe assina com o dedo na tela do entregador.",
  },
];

function ProofSettingsForm({ initial, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const changed = PROOF_OPTIONS.some(({ key }) => values[key] !== initial[key]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch("/company/settings", { proof: values });
      toast.success("Configurações salvas.");
      onSaved();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Comprovante de entrega"
      description="O que o entregador precisa registrar para finalizar. O operador pode finalizar por exceção (fica registrado na auditoria)."
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <div className={styles.options}>
        {PROOF_OPTIONS.map(({ key, label, hint }) => (
          <Checkbox
            key={key}
            label={label}
            hint={hint}
            checked={values[key]}
            onChange={(event) =>
              setValues((current) => ({ ...current, [key]: event.target.checked }))
            }
          />
        ))}
      </div>
      <div className={styles.actions}>
        <Button
          iconLeft={<Save aria-hidden="true" />}
          onClick={save}
          loading={saving}
          disabled={!changed}
        >
          Salvar
        </Button>
      </div>
    </Card>
  );
}

/** Configurações da empresa (somente administrador). */
export function SettingsPage() {
  const {
    data: company,
    error,
    loading,
    reload,
  } = useQuery((signal) => api.get("/company", { signal }).then((r) => r.data), []);

  return (
    <>
      <PageHeader title="Configurações" description="Regras da operação da sua empresa." />
      {error && <Alert tone="danger">{error.message}</Alert>}
      {loading && !company ? (
        <PageLoader label="Carregando configurações" />
      ) : (
        company && (
          <div className={styles.grid}>
            <ProofSettingsForm
              key={JSON.stringify(company.settings.proof)}
              initial={company.settings.proof}
              onSaved={reload}
            />
            <Card title="Empresa">
              <dl className={styles.facts}>
                <dt>Nome</dt>
                <dd>{company.name}</dd>
                <dt>Fuso horário</dt>
                <dd>{company.timezone}</dd>
              </dl>
              <p className={styles.muted}>
                Usado para calcular “hoje” no painel e no histórico. Alterações são feitas pelo
                suporte da plataforma.
              </p>
            </Card>
          </div>
        )
      )}
    </>
  );
}
