import { Eraser } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";

import { cx } from "@/lib/cx";

import styles from "./SignaturePad.module.css";

/**
 * Assinatura com o dedo (ou mouse). Pointer Events cobrem toque, caneta e
 * mouse com o mesmo código. O desenho é feito em resolução real da tela
 * (devicePixelRatio) para o traço não ficar serrilhado.
 *
 * ref expõe: toBlob() → Promise<Blob|null> (PNG) e clear().
 */
export function SignaturePad({ label, required = false, error, onChange, ref }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext?.("2d");
    if (!context) return; // ambiente sem canvas (ex.: testes)
    context.scale(ratio, ratio);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a"; // tinta escura sobre o fundo branco do quadro
  }, []);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event) => {
    const context = canvasRef.current.getContext("2d");
    canvasRef.current.setPointerCapture?.(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const move = (event) => {
    if (!drawing.current) return;
    const context = canvasRef.current.getContext("2d");
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
    if (empty) {
      setEmpty(false);
      onChange?.(true);
    }
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange?.(false);
  };

  useImperativeHandle(ref, () => ({
    clear,
    toBlob: () =>
      empty
        ? Promise.resolve(null)
        : new Promise((resolve) => canvasRef.current.toBlob(resolve, "image/png")),
  }));

  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <span className={styles.label}>
          {label}
          {required && <span className={styles.required}> (obrigatória)</span>}
        </span>
        <button type="button" className={styles.clear} onClick={clear} disabled={empty}>
          <Eraser aria-hidden="true" />
          Limpar
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className={cx(styles.pad, error && styles.padError)}
        aria-label="Área para assinar com o dedo"
        role="img"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      />
      {empty && <p className={styles.hint}>Peça para quem recebeu assinar no quadro acima.</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
