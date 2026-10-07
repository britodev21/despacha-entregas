import { Search, UserPlus } from "lucide-react";
import { useState } from "react";

import { api } from "@/api/client";
import { Button } from "@/components/ui/Button/Button";
import { Skeleton } from "@/components/ui/Skeleton/Skeleton";
import { TextField } from "@/components/ui/TextField/TextField";
import { ClientFormDialog } from "@/features/clients/ClientFormDialog";
import { formatAreaLine, formatStreetLine } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useQuery } from "@/lib/useQuery";

import styles from "./deliveries.module.css";

/**
 * Passo 1 da nova entrega: achar o cliente pelo nome ou telefone,
 * ou cadastrar na hora sem sair do fluxo.
 */
export function ClientPicker({ onSelect }) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const term = useDebouncedValue(search.trim());

  const { data, loading } = useQuery(
    (signal) =>
      term.length < 2
        ? Promise.resolve(null)
        : api
            .get("/clients", { signal, params: { search: term, limit: 8 } })
            .then((response) => response.data),
    [term],
  );

  return (
    <div className={styles.picker}>
      <TextField
        label="Cliente"
        type="search"
        placeholder="Digite o nome ou o telefone"
        data-autofocus
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        endAdornment={<Search aria-hidden="true" className={styles.searchIcon} />}
      />

      <div className={styles.pickerResults} aria-live="polite">
        {term.length >= 2 && loading && !data && (
          <>
            <Skeleton height="3.25rem" />
            <Skeleton height="3.25rem" />
          </>
        )}
        {data?.items.map((client) => (
          <button
            key={client.id}
            type="button"
            className={styles.pickerItem}
            onClick={() => onSelect(client.id)}
          >
            <span className={styles.pickerName}>{client.name}</span>
            <span className={styles.muted}>
              {[
                formatPhone(client.phone),
                client.default_address &&
                  `${formatStreetLine(client.default_address)} · ${formatAreaLine(client.default_address)}`,
              ]
                .filter(Boolean)
                .join(" — ") || "Sem telefone e sem endereço"}
            </span>
          </button>
        ))}
        {data && data.items.length === 0 && (
          <p className={styles.muted}>Nenhum cliente encontrado para “{term}”.</p>
        )}
      </div>

      <Button
        variant="secondary"
        iconLeft={<UserPlus aria-hidden="true" />}
        onClick={() => setCreating(true)}
      >
        Cadastrar novo cliente
      </Button>

      {creating && (
        <ClientFormDialog
          onClose={() => setCreating(false)}
          onSaved={(client) => {
            setCreating(false);
            onSelect(client.id);
          }}
        />
      )}
    </div>
  );
}
