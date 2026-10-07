import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  MapPin,
  MapPinPlus,
  Pencil,
  Phone,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { api, toApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { ConfirmDialog } from "@/components/ui/Dialog/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { cx } from "@/lib/cx";
import { formatAreaLine, formatDocument, formatStreetLine, formatZip } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useQuery } from "@/lib/useQuery";

import { AddressDialog } from "./AddressDialog";
import { ClientFormDialog } from "./ClientFormDialog";
import styles from "./clients.module.css";

function Fact({ label, children }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>
        {children || <span className={styles.muted}>—</span>}
      </span>
    </div>
  );
}

export function ClientDetailPage() {
  const { clientId } = useParams();
  const toast = useToast();
  const {
    data: client,
    error,
    loading,
    reload,
  } = useQuery(
    (signal) => api.get(`/clients/${clientId}`, { signal }).then((response) => response.data),
    [clientId],
  );

  // { type: "edit" | "address" | "archive" | "removeAddress", address? }
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const close = () => setDialog(null);

  const done = (message) => {
    close();
    toast.success(message);
    reload();
  };

  async function run(request, message) {
    setBusy(true);
    try {
      await request();
      done(message);
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !client) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" label="Carregando cliente" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={MapPin}
        tone="danger"
        title={error.status === 404 ? "Cliente não encontrado" : "Não foi possível carregar"}
        description={error.message}
        actions={
          <Button as={Link} to="/clientes">
            Voltar para clientes
          </Button>
        }
      />
    );
  }

  const setDefault = (address) =>
    run(
      () => api.patch(`/clients/${client.id}/addresses/${address.id}`, { is_default: true }),
      "Endereço principal atualizado.",
    );

  return (
    <>
      <Link to="/clientes" className={styles.backLink}>
        <ArrowLeft aria-hidden="true" />
        Clientes
      </Link>
      <PageHeader
        title={client.name}
        description={client.is_active ? null : "Cliente arquivado"}
        actions={
          <>
            <Button
              variant="secondary"
              iconLeft={<Pencil aria-hidden="true" />}
              onClick={() => setDialog({ type: "edit" })}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              iconLeft={
                client.is_active ? (
                  <Archive aria-hidden="true" />
                ) : (
                  <ArchiveRestore aria-hidden="true" />
                )
              }
              onClick={() => setDialog({ type: "archive" })}
            >
              {client.is_active ? "Arquivar" : "Reativar"}
            </Button>
          </>
        }
      />

      {!client.is_active && (
        <Alert tone="warning" className={styles.archivedAlert}>
          Cliente arquivado: não aparece na busca ao criar entregas.
        </Alert>
      )}

      <div className={styles.detailGrid}>
        <Card title="Dados">
          <div className={styles.facts}>
            <Fact label="Telefone">
              {client.phone && (
                <a href={`tel:+${client.phone}`} className={styles.phoneLink}>
                  <Phone aria-hidden="true" />
                  {formatPhone(client.phone)}
                </a>
              )}
            </Fact>
            <Fact label="E-mail">{client.email}</Fact>
            <Fact label="CPF/CNPJ">{formatDocument(client.document)}</Fact>
            <Fact label="Observações">
              {client.notes && <span className={styles.notes}>{client.notes}</span>}
            </Fact>
          </div>
        </Card>

        <Card
          title="Endereços"
          description="O principal é sugerido primeiro ao criar uma entrega."
          actions={
            <Button
              size="sm"
              variant="secondary"
              iconLeft={<MapPinPlus aria-hidden="true" />}
              onClick={() => setDialog({ type: "address" })}
              disabled={client.addresses.length >= 10}
            >
              Adicionar
            </Button>
          }
        >
          {client.addresses.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Nenhum endereço"
              description="Adicione um endereço para usar nas entregas."
            />
          ) : (
            <ul role="list" className={styles.addressList}>
              {client.addresses.map((address) => (
                <li
                  key={address.id}
                  className={cx(styles.addressCard, address.is_default && styles.addressDefault)}
                >
                  <div className={styles.addressInfo}>
                    <span className={styles.addressHeading}>
                      {address.label || "Endereço"}
                      {address.is_default && (
                        <Badge tone="brand" icon={<Star aria-hidden="true" />}>
                          Principal
                        </Badge>
                      )}
                    </span>
                    <span>{formatStreetLine(address)}</span>
                    <span className={styles.muted}>
                      {formatAreaLine(address)}
                      {address.zip_code && ` · CEP ${formatZip(address.zip_code)}`}
                    </span>
                    {address.reference && (
                      <span className={styles.reference}>
                        <MapPin aria-hidden="true" />
                        {address.reference}
                      </span>
                    )}
                  </div>
                  <div className={styles.addressActions}>
                    {!address.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        title="Tornar principal"
                        aria-label={`Tornar principal: ${formatStreetLine(address)}`}
                        onClick={() => setDefault(address)}
                        disabled={busy}
                      >
                        <Star aria-hidden="true" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      title="Editar"
                      aria-label={`Editar endereço: ${formatStreetLine(address)}`}
                      onClick={() => setDialog({ type: "address", address })}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      title="Remover"
                      aria-label={`Remover endereço: ${formatStreetLine(address)}`}
                      onClick={() => setDialog({ type: "removeAddress", address })}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {dialog?.type === "edit" && (
        <ClientFormDialog client={client} onClose={close} onSaved={(_, message) => done(message)} />
      )}
      {dialog?.type === "address" && (
        <AddressDialog
          key={dialog.address?.id ?? "new"}
          clientId={client.id}
          address={dialog.address}
          onClose={close}
          onSaved={done}
        />
      )}
      {dialog?.type === "archive" && (
        <ConfirmDialog
          open
          tone={client.is_active ? "danger" : "primary"}
          title={client.is_active ? "Arquivar cliente?" : "Reativar cliente?"}
          description={client.name}
          confirmLabel={client.is_active ? "Arquivar cliente" : "Reativar cliente"}
          loading={busy}
          onCancel={close}
          onConfirm={() =>
            run(
              () => api.patch(`/clients/${client.id}`, { is_active: !client.is_active }),
              client.is_active ? "Cliente arquivado." : "Cliente reativado.",
            )
          }
        >
          <p className={styles.muted}>
            {client.is_active
              ? "O cliente some da busca, mas o histórico de entregas é mantido. Você pode reativar depois."
              : "O cliente volta a aparecer na busca."}
          </p>
        </ConfirmDialog>
      )}
      {dialog?.type === "removeAddress" && (
        <ConfirmDialog
          open
          title="Remover endereço?"
          description={formatStreetLine(dialog.address)}
          confirmLabel="Remover endereço"
          loading={busy}
          onCancel={close}
          onConfirm={() =>
            run(
              () => api.delete(`/clients/${client.id}/addresses/${dialog.address.id}`),
              "Endereço removido.",
            )
          }
        >
          <p className={styles.muted}>Entregas já feitas para este endereço não são afetadas.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
