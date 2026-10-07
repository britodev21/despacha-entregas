import { Contact, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { api } from "@/api/client";
import { Alert } from "@/components/ui/Alert/Alert";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { DataTable } from "@/components/ui/DataTable/DataTable";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader/PageHeader";
import { TextField } from "@/components/ui/TextField/TextField";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { formatAreaLine, formatStreetLine } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useQuery } from "@/lib/useQuery";

import { ClientFormDialog } from "./ClientFormDialog";
import styles from "./clients.module.css";

const PAGE_SIZE = 50;

export function ClientsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, error, loading, reload } = useQuery(
    (signal) =>
      api
        .get("/clients", {
          signal,
          params: {
            search: debouncedSearch || undefined,
            include_inactive: showArchived || undefined,
            limit: PAGE_SIZE,
          },
        })
        .then((response) => response.data),
    [debouncedSearch, showArchived],
  );

  const columns = [
    {
      key: "name",
      header: "Cliente",
      primary: true,
      render: (client) => (
        <Link to={`/clientes/${client.id}`} className={styles.clientLink}>
          <span className={styles.clientName}>{client.name}</span>
          <span className={styles.muted}>{formatPhone(client.phone) || "Sem telefone"}</span>
        </Link>
      ),
    },
    {
      key: "address",
      header: "Endereço principal",
      render: (client) =>
        client.default_address ? (
          <span className={styles.addressCell}>
            <span>{formatStreetLine(client.default_address)}</span>
            <span className={styles.muted}>{formatAreaLine(client.default_address)}</span>
          </span>
        ) : (
          <span className={styles.muted}>Nenhum endereço</span>
        ),
    },
    {
      key: "address_count",
      header: "Endereços",
      render: (client) => <span className="tabular">{client.address_count}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (client) =>
        client.is_active ? (
          <Badge tone="success">Ativo</Badge>
        ) : (
          <Badge tone="canceled">Arquivado</Badge>
        ),
    },
  ];

  const filtered = Boolean(debouncedSearch);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Quem recebe as entregas e seus endereços."
        actions={
          <Button iconLeft={<Plus aria-hidden="true" />} onClick={() => setCreating(true)}>
            Novo cliente
          </Button>
        }
      />

      <div className={styles.toolbar} role="search">
        <TextField
          label="Buscar cliente"
          type="search"
          placeholder="Nome ou telefone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          endAdornment={<Search aria-hidden="true" className={styles.searchIcon} />}
          className={styles.search}
        />
        <Checkbox
          label="Mostrar arquivados"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
      </div>

      {error ? (
        <Alert tone="danger" title="Não foi possível carregar os clientes.">
          {error.message}{" "}
          <Button variant="secondary" size="sm" onClick={reload}>
            Tentar novamente
          </Button>
        </Alert>
      ) : !loading && data?.items.length === 0 ? (
        <EmptyState
          icon={Contact}
          title={filtered ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={
            filtered
              ? "Confira o nome ou os números do telefone."
              : "Cadastre clientes para agilizar a criação de entregas."
          }
          actions={
            !filtered && (
              <Button iconLeft={<Plus aria-hidden="true" />} onClick={() => setCreating(true)}>
                Cadastrar primeiro cliente
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable
            caption="Clientes"
            columns={columns}
            rows={data?.items ?? []}
            loading={loading && !data}
          />
          {data && (
            <p className={styles.count} aria-live="polite">
              {data.total === 1 ? "1 cliente" : `${data.total} clientes`}
              {data.total > data.items.length &&
                ` · mostrando ${data.items.length}, refine a busca`}
            </p>
          )}
        </>
      )}

      {creating && (
        <ClientFormDialog
          onClose={() => setCreating(false)}
          onSaved={(client, message) => {
            setCreating(false);
            toast.success(message);
            navigate(`/clientes/${client.id}`);
          }}
        />
      )}
    </>
  );
}
