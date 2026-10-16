import { Headset, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/Button/Button";

import { CONTACT_URL } from "./contact";

function WhatsAppButton({ icon: Icon, label, size, variant, className }) {
  if (!CONTACT_URL) return null;
  return (
    <Button
      as="a"
      href={CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      size={size}
      variant={variant}
      className={className}
    >
      <Icon aria-hidden="true" />
      {label}
      <span className="sr-only"> (abre o WhatsApp)</span>
    </Button>
  );
}

/** Intenção "vendas". Mesmo rótulo em todo o site. Sem número configurado, some. */
export function DemoButton({ size = "lg", className }) {
  return (
    <WhatsAppButton
      icon={MessageCircle}
      label="Agendar demonstração"
      size={size}
      className={className}
    />
  );
}

/** Intenção "ajuda". Mesmo rótulo em todo o site. Sem número configurado, some. */
export function SupportButton({ size = "lg", variant = "primary", className }) {
  return (
    <WhatsAppButton
      icon={Headset}
      label="Falar com o suporte"
      size={size}
      variant={variant}
      className={className}
    />
  );
}
