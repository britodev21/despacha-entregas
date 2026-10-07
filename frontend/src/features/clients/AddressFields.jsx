import { useRef, useState } from "react";

import { Checkbox } from "@/components/ui/Checkbox/Checkbox";
import { Select } from "@/components/ui/Select/Select";
import { TextField } from "@/components/ui/TextField/TextField";
import { BRAZILIAN_STATES } from "@/lib/format";
import { lookupCep } from "@/lib/viacep";

import styles from "./clients.module.css";

const STATE_OPTIONS = [
  { value: "", label: "UF" },
  ...BRAZILIAN_STATES.map((uf) => ({ value: uf, label: uf })),
];

/**
 * Campos de endereço com preenchimento automático pelo CEP.
 * Controlado: quem usa guarda os valores e recebe onChange(campo, valor).
 */
export function AddressFields({ values, errors = {}, onChange, showDefaultToggle = true }) {
  const [cepStatus, setCepStatus] = useState(null); // null | "loading" | "notfound"
  const numberRef = useRef(null);

  const field = (name) => ({
    value: values[name],
    onChange: (event) => onChange(name, event.target.value),
    error: errors[name],
  });

  async function handleCepChange(event) {
    const raw = event.target.value;
    onChange("zip_code", raw);
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepStatus(null);
      return;
    }
    setCepStatus("loading");
    const found = await lookupCep(digits);
    if (!found) {
      setCepStatus("notfound");
      return;
    }
    setCepStatus(null);
    for (const [key, value] of Object.entries(found)) {
      if (value) onChange(key, value);
    }
    // Rua, bairro e cidade preenchidos: o próximo passo é o número.
    numberRef.current?.focus();
  }

  const cepHint =
    cepStatus === "loading"
      ? "Buscando endereço…"
      : cepStatus === "notfound"
        ? "CEP não encontrado. Preencha o endereço manualmente."
        : "Preenche rua, bairro e cidade automaticamente.";

  return (
    <div className={styles.addressGrid}>
      <TextField
        data-autofocus
        label="CEP"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="00000-000"
        maxLength={9}
        {...field("zip_code")}
        onChange={handleCepChange}
        hint={cepHint}
        className={styles.colZip}
      />
      <TextField label="Rua" required {...field("street")} className={styles.colStreet} />
      <TextField
        ref={numberRef}
        label="Número"
        required
        placeholder="S/N"
        {...field("number")}
        className={styles.colNumber}
      />
      <TextField
        label="Complemento"
        placeholder="Apto, bloco, fundos…"
        {...field("complement")}
        className={styles.colComplement}
      />
      <TextField label="Bairro" required {...field("neighborhood")} className={styles.colHalf} />
      <TextField label="Cidade" required {...field("city")} className={styles.colCity} />
      <Select label="UF" options={STATE_OPTIONS} {...field("state")} className={styles.colState} />
      <TextField
        label="Ponto de referência"
        placeholder="Ex.: portão azul, ao lado da padaria"
        hint="Ajuda muito o entregador a achar o local."
        {...field("reference")}
        className={styles.colFull}
      />
      <TextField
        label="Identificação"
        placeholder="Casa, Trabalho…"
        {...field("label")}
        className={styles.colHalf}
      />
      {showDefaultToggle && (
        <Checkbox
          label="Endereço principal"
          hint="Sugerido primeiro ao criar entregas."
          checked={values.is_default}
          onChange={(event) => onChange("is_default", event.target.checked)}
          className={styles.colHalfCheckbox}
        />
      )}
    </div>
  );
}
