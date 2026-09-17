"""Sayfa işle: tespit et → benzer renge yayarak sil → fontla yeniden diz."""

import io
import os
import re

import numpy as np
from PIL import Image

from .ayar import load_ayar
from .fonts import effective_kind, font_for_kind
from .mask import auto_text_color, erase_mask, grow_mask, inner_box
from .typeset import draw_block
from .vision import detect_regions, has_llm_keys, merge_regions, normalize_regions, offset_regions


def _inset_box(box, ratio):
    x1, y1, x2, y2 = [float(v) for v in box]
    dx = (x2 - x1) * ratio
    dy = (y2 - y1) * ratio
    return (int(x1 + dx), int(y1 + dy), int(x2 - dx), int(y2 - dy))


_HANGUL_KANA = re.compile(r"[\uac00-\ud7af\u3040-\u30ff]")
_EN_LEFTOVER = re.compile(
    r"\b(THE|YOU|HAS|HAVE|THIS|THAT|SUMMON|OBTAINED|WEAPON|MASTER|WILL|THEY)\b",
    re.I,
)


def _is_dirty(region):
    src = region.get("source") or ""
    text = region.get("text") or ""
    if _HANGUL_KANA.search(src) or _HANGUL_KANA.search(text):
        return True
    return bool(_EN_LEFTOVER.search(src))


def _to_png_bytes(image):
    buf = io.BytesIO()
    rgb = image.convert("RGB")
    rgb.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _split_strips(image, max_h, overlap):
    w, h = image.size
    if h <= max_h:
        return [(0, image)]
    chunks = []
    y = 0
    while y < h:
        y2 = min(h, y + max_h)
        chunks.append((y, image.crop((0, y, w, y2))))
        if y2 >= h:
            break
        y += max(1, max_h - overlap)
    return chunks


def collect_regions(image, ayar, ready_regions=None):
    if ready_regions is not None:
        return merge_regions(ready_regions, ayar.get("birlestirme_iou", 0.3))

    max_h = int(ayar.get("serit_max_yukseklik", 1700))
    overlap = int(ayar.get("serit_ortusme", 150))
    all_regions = []
    for dy, chunk in _split_strips(image, max_h, overlap):
        data = detect_regions(_to_png_bytes(chunk), mime="image/png")
        if not data:
            continue
        if data.get("already_clean") and not data.get("regions"):
            continue
        regs = normalize_regions(data, chunk.size[0], chunk.size[1])
        all_regions.extend(offset_regions(regs, dy=dy))
    return merge_regions(all_regions, ayar.get("birlestirme_iou", 0.3))


def apply_regions(image, regions, ayar):
    if not regions:
        return image, 0
    np_img = np.array(image.convert("RGB"))
    prepared = []
    max_grow = int(ayar.get("yayilma_px", 26))
    thresh = float(ayar.get("renk_esigi", 36))
    pad_ratio = float(ayar.get("ic_bosluk", 0.11))

    for r in regions:
        mask, bg = grow_mask(np_img, r["box"], max_grow=max_grow, thresh=thresh)
        use_inpaint = (r.get("kind") or "") == "sfx"
        np_img = erase_mask(np_img, mask, bg, use_inpaint=use_inpaint)
        inner = inner_box(mask, pad_ratio=pad_ratio)
        prepared.append((r, inner, bg))

    out = Image.fromarray(np_img)
    drawn = 0
    min_s = int(ayar.get("min_punto", 13))
    max_s = int(ayar.get("max_punto", 64))
    spacing = float(ayar.get("satir_araligi", 1.16))
    ui_track = float(ayar.get("ui_harf_araligi", 0.045))
    stroke_ratio = float(ayar.get("kontur_orani", 0.0))
    sfx_stroke = float(ayar.get("sfx_kontur_orani", 0.11))
    shout_stroke = float(ayar.get("bagirma_kontur_orani", 0.10))

    for r, inner, bg in prepared:
        if r.get("erase_only"):
            continue
        text = (r.get("text") or "").strip()
        if not text:
            continue
        kind = effective_kind(r.get("kind") or "dialogue", text, r.get("source") or "")
        font_path = font_for_kind(kind, ayar)
        fill = auto_text_color(bg)
        tracking = ui_track if kind == "ui" else 0.0
        if kind == "sfx":
            stroke = sfx_stroke
        elif kind == "bagirma":
            stroke = shout_stroke
        else:
            stroke = stroke_ratio
        max_lines = 1 if kind == "sfx" else None
        if kind == "sfx":
            inner = _inset_box(r["box"], 0.04)
        x1, y1, x2, y2 = inner
        if x2 - x1 < 8 or y2 - y1 < 8:
            continue
        draw_block(
            out,
            text,
            (x1, y1, x2, y2),
            font_path,
            fill,
            min_s,
            max_s,
            spacing,
            tracking=tracking,
            stroke_ratio=stroke,
            max_lines=max_lines,
        )
        drawn += 1
    return out, drawn


def process_image(path, ayar=None, regions=None, out_path=None):
    """Tek sayfa. regions verilirse Gemini çağrılmaz (test/onarım)."""
    ayar = ayar or load_ayar()
    if not ayar.get("aktif", True) and regions is None:
        return path, 0
    image = Image.open(path).convert("RGB")
    found = collect_regions(image, ayar, ready_regions=regions)
    if not found:
        return path, 0
    if ayar.get("sadece_kirli") and not any(_is_dirty(r) for r in found):
        return path, 0
    out, drawn = apply_regions(image, found, ayar)
    dest = out_path or path
    os.makedirs(os.path.dirname(os.path.abspath(dest)) or ".", exist_ok=True)
    ext = os.path.splitext(dest)[1].lower()
    quality = int(ayar.get("webp_kalite", 90))
    if ext in (".jpg", ".jpeg"):
        out.save(dest, "JPEG", quality=max(quality, 90), optimize=True)
    elif ext == ".png":
        out.save(dest, "PNG", optimize=True)
    else:
        out.save(dest, "WEBP", quality=quality, method=6)
    return dest, drawn


def process_saved_page(path, ayar=None):
    """botoon.py kayıttan sonra çağırır. Hata yutmaz, sayı döner."""
    ayar = ayar or load_ayar()
    if not ayar.get("aktif", True):
        return 0
    if not path or not os.path.isfile(path):
        return 0
    if not has_llm_keys():
        print("      ⚠️ Overlay: DEEPSEEK_API_KEY yok — dizgi atlandı")
        return 0
    dest, drawn = process_image(path, ayar=ayar)
    if drawn:
        print(f"      🖋️ Overlay: {drawn} metin yeniden dizildi")
    else:
        print("      🖋️ Overlay: bölge yok / atlandı")
    return drawn
