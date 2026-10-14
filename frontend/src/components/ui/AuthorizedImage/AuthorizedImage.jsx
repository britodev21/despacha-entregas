import { useEffect, useState } from "react";

import { api } from "@/api/client";

import { Skeleton } from "../Skeleton/Skeleton";
import styles from "./AuthorizedImage.module.css";

/**
 * Imagem protegida: o arquivo só sai da API com o token de acesso, que um
 * <img src> comum não envia. Baixamos com o Axios (que manda o token) e
 * mostramos pelo endereço temporário `blob:` — liberado ao sair da tela.
 *
 * src: "/api/v1/files/{id}" (como vem da API)
 */
export function AuthorizedImage({ src, alt, className }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let active = true;
    api
      .get(src.replace(/^\/api\/v1/, ""), { responseType: "blob" })
      .then(({ data }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (failed) return <span className={styles.failed}>Imagem indisponível</span>;
  if (!url) return <Skeleton width="8rem" height="6rem" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>
      <img src={url} alt={alt} className={className ?? styles.image} />
    </a>
  );
}
