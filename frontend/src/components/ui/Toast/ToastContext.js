import { createContext, useContext } from "react";

export const ToastContext = createContext(null);

/** toast.success("Salvo"), toast.error("Falhou") */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return context;
}
