import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { TextField } from "./TextField";
import styles from "./TextField.module.css";

/**
 * Campo de senha com botão mostrar/ocultar e aviso de Caps Lock
 * (causa número um de "senha errada" que não é senha errada).
 */
export function PasswordField({ hint, onKeyUp, ...props }) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const handleKey = (event) => {
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);
    onKeyUp?.(event);
  };

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      onKeyUp={handleKey}
      hint={capsLock ? "Caps Lock está ativado." : hint}
      endAdornment={
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      }
    />
  );
}
