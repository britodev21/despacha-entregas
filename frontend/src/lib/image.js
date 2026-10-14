/**
 * Reduz a foto NO CELULAR antes de enviar: de ~4 MB para ~200 KB.
 * Em 4G ruim, é a diferença entre enviar em 2 s ou desistir.
 *
 * O servidor valida e recodifica de novo (nunca confie no cliente);
 * isto aqui é só economia de dados e de tempo.
 */
export async function compressImage(file, { maxSide = 1600, quality = 0.82 } = {}) {
  if (typeof createImageBitmap !== "function") return file;
  try {
    // imageOrientation: respeita a rotação da câmera (foto "de pé").
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file; // formato que o navegador não decodifica: o servidor decide
  }
}

/** Envia um arquivo para uma entrega. basePath: "/me/deliveries" ou "/deliveries". */
export async function uploadDeliveryFile(api, basePath, deliveryId, kind, blob, filename) {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", blob, filename);
  const { data } = await api.post(`${basePath}/${deliveryId}/files`, form);
  return data;
}
