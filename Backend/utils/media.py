import io
import os
import uuid
from typing import Optional
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException, UploadFile

ALLOWED_IMAGE_FORMATS = {
    "JPEG": "jpg",
    "PNG": "png",
    "WEBP": "webp",
    "GIF": "gif",
}

DEFAULT_MAX_IMAGE_BYTES = 15 * 1024 * 1024  # 15 MB


def _detect_magic_format(data: bytes) -> Optional[str]:
    if data.startswith(b"\xff\xd8\xff"):
        return "JPEG"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "GIF"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "WEBP"
    return None


def validate_and_save_image(
    upload_file: UploadFile,
    dest_dir: str,
    max_bytes: int = DEFAULT_MAX_IMAGE_BYTES,
    prefix: str = "",
) -> str:
    """
    Görsel yüklemelerini boyut sınırı, magic-byte kontrolü ve Pillow doğrulamasıyla
    güvenli biçimde diske yazar; normalize edilmiş 'static/...' göreli yolunu döner.
    """
    if upload_file is None or getattr(upload_file, "file", None) is None:
        raise HTTPException(status_code=400, detail="Geçersiz dosya yüklemesi.")

    file_obj = upload_file.file
    try:
        file_obj.seek(0)
    except Exception:
        pass

    chunks = []
    total_read = 0
    chunk_size = 64 * 1024
    while True:
        chunk = file_obj.read(chunk_size)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > max_bytes:
            max_mb = max(1, max_bytes // (1024 * 1024))
            raise HTTPException(
                status_code=413,
                detail=f"Görsel boyutu çok büyük (maksimum {max_mb} MB).",
            )
        chunks.append(chunk)

    data = b"".join(chunks)
    if not data:
        raise HTTPException(status_code=400, detail="Boş dosya yüklenemez.")

    magic_fmt = _detect_magic_format(data)
    if not magic_fmt:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz veya desteklenmeyen görsel formatı. Sadece JPG, PNG, WEBP veya GIF kabul edilir.",
        )

    try:
        with Image.open(io.BytesIO(data)) as img:
            detected_fmt = (img.format or "").upper()
            if detected_fmt not in ALLOWED_IMAGE_FORMATS or detected_fmt != magic_fmt:
                raise HTTPException(
                    status_code=400,
                    detail="Görsel başlığı ile dosya içeriği uyuşmuyor.",
                )
            img.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, Exception):
        raise HTTPException(
            status_code=400,
            detail="Bozuk veya geçersiz görsel dosyası.",
        )

    ext = ALLOWED_IMAGE_FORMATS[detected_fmt]
    safe_prefix = "".join(c for c in (prefix or "") if c.isalnum() or c in ("-", "_"))
    filename = f"{safe_prefix}{uuid.uuid4()}.{ext}"

    os.makedirs(dest_dir, exist_ok=True)
    full_path = os.path.join(dest_dir, filename)
    with open(full_path, "wb") as out:
        out.write(data)

    norm = full_path.replace("\\", "/")
    if "static/" in norm:
        return "static/" + norm.split("static/", 1)[1]
    return norm.lstrip("./")
