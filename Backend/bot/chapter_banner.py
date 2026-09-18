"""Her yeni bölümün başına konan Kaos Manga görseli."""

import os

BOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(BOT_DIR)
BANNER_SRC = os.path.join(BOT_DIR, "assets", "kaos-bolum-baslangic.webp")
PUBLIC_BANNER = os.path.join(BACKEND_DIR, "static", "branding", "kaos-bolum-baslangic.webp")
BANNER_MARK = "[KAOS-BANNER]"
BANNER_FILENAME = "00-kaos-okuyunuz.webp"


def ensure_public_banner():
    """API'nin /static/branding altından servis etmesi için kopyala."""
    if not os.path.isfile(BANNER_SRC):
        return None
    os.makedirs(os.path.dirname(PUBLIC_BANNER), exist_ok=True)
    if (not os.path.isfile(PUBLIC_BANNER)) or (
        os.path.getmtime(BANNER_SRC) > os.path.getmtime(PUBLIC_BANNER)
    ):
        import shutil
        shutil.copy2(BANNER_SRC, PUBLIC_BANNER)
    return PUBLIC_BANNER


def with_text_banner(content):
    """Roman metninin başına banner işaretini ekle (yoksa)."""
    ensure_public_banner()
    text = content or ""
    if BANNER_MARK in text or "kaos-bolum-baslangic" in text:
        return text
    body = text.lstrip()
    if not body:
        return f"{BANNER_MARK}\n"
    return f"{BANNER_MARK}\n\n{body}"


def save_webtoon_banner(episode_folder, dest_name=BANNER_FILENAME, page_width=None):
    """Kare görseli bölüm klasörüne, sayfa genişliğine göre kaydet. Mutlak yol döner."""
    from PIL import Image

    ensure_public_banner()
    if not os.path.isfile(BANNER_SRC):
        print("      ⚠️ Bölüm başı görseli yok: assets/kaos-bolum-baslangic.webp")
        return None
    os.makedirs(episode_folder, exist_ok=True)
    img = Image.open(BANNER_SRC).convert("RGB")
    w, h = img.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    out_w = int(page_width) if page_width else side
    out_w = max(720, min(out_w, 2048))
    if img.size[0] != out_w:
        img = img.resize((out_w, out_w), Image.Resampling.LANCZOS)
    dest = os.path.join(episode_folder, dest_name)
    img.save(dest, "WEBP", quality=90, method=6)
    return dest


def prepend_webtoon_banner(episode_folder, saved_paths, backend_dir=None):
    """İndirilen sayfaların önüne hizalı banner koy. Relatif yollar (backend'e göre)."""
    backend_dir = backend_dir or BACKEND_DIR
    if not saved_paths:
        return saved_paths
    if any("00-kaos-okuyunuz" in (p or "") for p in saved_paths):
        return saved_paths
    page_width = None
    first = saved_paths[0]
    first_abs = first if os.path.isabs(first) else os.path.join(backend_dir, first)
    try:
        from PIL import Image

        with Image.open(first_abs) as im:
            page_width = im.size[0]
    except Exception:
        page_width = None
    dest = save_webtoon_banner(episode_folder, BANNER_FILENAME, page_width)
    if not dest:
        return saved_paths
    rel = os.path.relpath(dest, backend_dir).replace("\\", "/")
    print(f"      🟣 Bölüm başına Kaos görseli eklendi ({page_width or '?'}px)")
    return [rel] + list(saved_paths)
