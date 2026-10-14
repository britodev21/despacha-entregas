import {
  CircleHelp,
  DoorClosed,
  MapPinOff,
  PackageX,
  ShieldX,
  TriangleAlert,
  UserX,
} from "lucide-react";

/** Tipos de ocorrência (valores do backend) com texto e ícone. */
export const OCCURRENCE_TYPES = [
  { value: "CUSTOMER_ABSENT", label: "Cliente ausente", Icon: UserX },
  { value: "WRONG_ADDRESS", label: "Endereço incorreto", Icon: MapPinOff },
  { value: "REFUSED", label: "Cliente recusou", Icon: ShieldX },
  { value: "ACCESS_PROBLEM", label: "Problema de acesso", Icon: DoorClosed },
  { value: "DAMAGED_PRODUCT", label: "Produto danificado", Icon: PackageX },
  { value: "DELIVERY_PROBLEM", label: "Problema na entrega", Icon: TriangleAlert },
  { value: "OTHER", label: "Outro", Icon: CircleHelp },
];

export const OCCURRENCE_LABELS = Object.fromEntries(
  OCCURRENCE_TYPES.map((type) => [type.value, type.label]),
);
