import io
import os
import uuid
from typing import Optional
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import HTTPException, UploadFile

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_ROOT = os.path.realpath(os.path.join(BACKEND_DIR, "static"))

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


def _encode_to_webp(
    data: bytes,
    detected_fmt: str,
    max_width: Optional[int],
    quality: int,
) -> tuple[bytes, str]:
    with Image.open(io.BytesIO(data)) as img:
        is_animated = bool(getattr(img, "is_animated", False) or getattr(img, "n_frames", 1) > 1)
        if detected_fmt == "GIF" and is_animated:
            return data, "gif"
        if detected_fmt == "WEBP" and is_animated:
            return data, "webp"
        if detected_fmt == "GIF":
            return data, "gif"

        transposed = ImageOps.exif_transpose(img)
        if max_width is not None and max_width > 0 and transposed.width > max_width:
            ratio = max_width / float(transposed.width)
            new_height = max(1, int(round(transposed.height * ratio)))
            resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)
            transposed = transposed.resize((max_width, new_height), resample)

        has_alpha = (
            transposed.mode in ("RGBA", "LA", "PA")
            or (transposed.mode == "P" and "transparency" in transposed.info)
        )
        if has_alpha:
            if transposed.mode != "RGBA":
                transposed = transposed.convert("RGBA")
        elif transposed.mode != "RGB":
            transposed = transposed.convert("RGB")

        out_buf = io.BytesIO()
        transposed.save(out_buf, format="WEBP", quality=quality, method=4)
        return out_buf.getvalue(), "webp"


def validate_and_save_image(
    upload_file: UploadFile,
    dest_dir: str,
    max_bytes: int = DEFAULT_MAX_IMAGE_BYTES,
    prefix: str = "",
    convert_webp: bool = True,
    max_width: Optional[int] = None,
    quality: int = 84,
) -> str:
    """
    Görsel yüklemelerini boyut sınırı, magic-byte kontrolü ve Pillow doğrulamasıyla
    güvenli biçimde işler; JPEG/PNG/WEBP görsellerini EXIF doğrultma + orantılı
    küçültme + optimize WebP dönüşümü ile diske yazar ve 'static/...' döner.
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

    if convert_webp:
        out_bytes, ext = _encode_to_webp(data, detected_fmt, max_width, quality)
    else:
        out_bytes = data
        ext = ALLOWED_IMAGE_FORMATS[detected_fmt]

    safe_prefix = "".join(c for c in (prefix or "") if c.isalnum() or c in ("-", "_"))
    filename = f"{safe_prefix}{uuid.uuid4()}.{ext}"

    os.makedirs(dest_dir, exist_ok=True)
    full_path = os.path.join(dest_dir, filename)
    with open(full_path, "wb") as out:
        out.write(out_bytes)

    norm = full_path.replace("\\", "/")
    if "static/" in norm:
        return "static/" + norm.split("static/", 1)[1]
    return norm.lstrip("./")


def delete_static_file_safe(rel_path: Optional[str], *, static_root: Optional[str] = None) -> bool:
    """
    Yalnızca Backend/static/ (veya belirtilen static_root) içindeki yerel medya
    dosyalarını siler; path traversal ('..'), uzak URL ve kök dizin silmelerini engeller.
    """
    if not rel_path or not isinstance(rel_path, str):
        return False

    cleaned = rel_path.strip().replace("\\", "/")
    if not cleaned or cleaned.startswith(("http://", "https://", "//", "data:")):
        return False

    if cleaned.startswith("/api/static/"):
        cleaned = cleaned[len("/api/"):]
    cleaned = cleaned.lstrip("/")

    if not cleaned.startswith("static/"):
        return False

    rel_inside = cleaned[len("static/"):]
    if not rel_inside or rel_inside.startswith("/"):
        return False

    root = os.path.realpath(static_root) if static_root else STATIC_ROOT
    candidate = os.path.realpath(os.path.join(root, rel_inside))

    try:
        common = os.path.commonpath([root, candidate])
    except ValueError:
        return False

    if common != root or candidate == root:
        return False

    if not os.path.isfile(candidate):
        return False

    try:
        os.remove(candidate)
        return True
    except OSError:
        return False
