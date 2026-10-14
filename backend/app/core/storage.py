"""Armazenamento de imagens enviadas (fotos e assinaturas) — ADR-10.

Defesas, na ordem em que acontecem:
1. Tamanho máximo lido do upload (não confiamos no Content-Length).
2. O conteúdo precisa ser uma imagem de verdade: o Pillow abre e verifica.
   A extensão do arquivo e o Content-Type enviados são ignorados.
3. Limite de pixels: protege contra "decompression bomb" (um PNG pequeno
   que vira gigabytes ao ser aberto).
4. A imagem é RECODIFICADA: metadados (EXIF com GPS do celular, modelo do
   aparelho...) e qualquer conteúdo escondido são descartados.
5. O nome no disco é gerado pelo servidor (UUID): o nome original nunca é
   usado, então não há path traversal ("../../etc/passwd").
"""

import contextlib
import io
import uuid
import warnings
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.core.errors import AppError

MAX_PIXELS = 40_000_000  # ~ 7000 x 5700: muito acima de qualquer câmera de celular
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class InvalidImageError(AppError):
    code = "INVALID_IMAGE"
    message = "Arquivo inválido. Envie uma foto (JPG, PNG ou WebP)."


class FileTooLargeError(AppError):
    status_code = 413
    code = "FILE_TOO_LARGE"
    message = "Arquivo muito grande."


@dataclass(frozen=True)
class StoredFile:
    key: str  # caminho relativo dentro de UPLOAD_DIR
    content_type: str
    size_bytes: int


def _root() -> Path:
    return get_settings().upload_dir.resolve()


def read_limited(stream, max_bytes: int) -> bytes:
    """Lê no máximo max_bytes; se houver mais, recusa (sem ler tudo para a memória)."""
    data = stream.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise FileTooLargeError(f"Arquivo muito grande (máximo {max_bytes // (1024 * 1024)} MB).")
    return data


def save_image(
    data: bytes, *, company_id: uuid.UUID, kind: str, max_side: int = 1600
) -> StoredFile:
    """Valida e recodifica a imagem. Fotos viram JPEG; assinaturas, PNG."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as probe:
                probe.verify()  # estrutura do arquivo íntegra
            image = Image.open(io.BytesIO(data))
            image.load()
    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise InvalidImageError() from None
    if image.format not in {"JPEG", "PNG", "WEBP"}:
        raise InvalidImageError()

    # Respeita a orientação da câmera ANTES de descartar o EXIF.
    image = ImageOps.exif_transpose(image)
    image.thumbnail((max_side, max_side))

    out = io.BytesIO()
    if kind == "signature":
        image.convert("RGBA").save(out, format="PNG", optimize=True)
        ext, content_type = "png", "image/png"
    else:
        image.convert("RGB").save(out, format="JPEG", quality=82, optimize=True)
        ext, content_type = "jpg", "image/jpeg"
    # Nenhum `exif=` é passado ao salvar: os metadados ficam para trás.

    now = datetime.now(UTC)
    key = f"{company_id}/{now:%Y/%m}/{uuid.uuid4().hex}.{ext}"
    path = _root() / key
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = out.getvalue()
    path.write_bytes(payload)
    return StoredFile(key=key, content_type=content_type, size_bytes=len(payload))


def resolve(key: str) -> Path:
    """Caminho absoluto de um arquivo salvo, garantindo que fica dentro do diretório."""
    root = _root()
    path = (root / key).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise AppError("Arquivo não encontrado.", code="FILE_NOT_FOUND")
    return path


def delete(key: str) -> None:
    with contextlib.suppress(AppError):
        resolve(key).unlink()
