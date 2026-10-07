import { formatZip } from "@/lib/format";

export const EMPTY_ADDRESS = {
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: "",
  label: "",
  is_default: false,
};

/** Converte um endereço da API para os valores do formulário. */
export function addressToForm(address) {
  if (!address) return { ...EMPTY_ADDRESS };
  return Object.fromEntries(
    Object.keys(EMPTY_ADDRESS).map((key) => [
      key,
      key === "zip_code" ? formatZip(address.zip_code) : (address[key] ?? EMPTY_ADDRESS[key]),
    ]),
  );
}
