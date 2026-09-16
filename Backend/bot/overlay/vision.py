"""DeepSeek Vision: balon kutuları, asıl metin, Türkçe çeviri."""

import json
import re
import sys

from .ayar import bot_dir

_bot = bot_dir()
if _bot not in sys.path:
    sys.path.insert(0, _bot)

PROMPT = """Sen Kaos Manga için manga/webtoon dizgicisisin. Görseldeki TÜM yazıları oku.

Bu görsellerde sık görülen hatalar:
- İngilizce/Korece asıl metin silinmeden üstüne Türkçe yazılmış (kalıntı).
- Türkçe yanlış balona veya çerçeve dışına taşmış.
- İsimler bitişik yazılmış (Ustaanytng gibi).
- Eşya adları uydurma transliterasyon (demirkilic). Font varsayılan ve çirkin.

Görevin — JSON döndür:
{
  "already_clean": false,
  "regions": [
    {
      "x1": 0, "y1": 0, "x2": 1000, "y2": 1000,
      "kind": "dialogue|thought|narration|ui|sfx",
      "source": "asıl dildeki metin",
      "text": "doğal Türkçe",
      "erase_only": false
    }
  ]
}

Koordinatlar 0-1000 normalize (x1,y1 sol üst; x2,y2 sağ alt). Kutuyu ASIL metnin (İngilizce/Korece) üzerine koy; üstteki yanlış overlay'e göre kaydırma. Aynı balondaki TR+EN kalıntısı TEK bölgedir.

kind:
- dialogue: konuşma balonu
- thought: düşünce balonu
- narration: kutu/anlatıcı
- ui: sistem/menü/loot/ipucu paneli (süslü çerçeve). Bağırma değil.
- sfx: ses efekti (웅성, BOOM)
- bagirma: bağırma / haykırış (büyük harf, ünlem: "NE Mİ İSTİYORUM?", "Söyleme!")

Çeviri kuralları:
- Özel isimleri çevirme (AnyTNG, Molmont). "Master AnyTNG" → "Usta AnyTNG" (bitiştirme YASAK).
- Eşya/yetenek adlarını Türkçeleştir: "Low-Grade Bow" → "Düşük Seviye Yay". Transliterasyon yok.
- Rank/harf notlarını koru: (E-), (D+), (F).
- SFX'i de Türkçeleştir (웅성 → uğultu).
- Aynı cümleyi iki kez yazma.
- already_clean yalnızca sayfada hiç yazı yoksa true. Yazı varsa her zaman regions doldur — fontu biz yeniden basacağız.
- erase_only: bu kutu yalnızca silinecek yinelenen kalıntıysa true (çeviri başka bölgede).
Sadece JSON yaz."""


def _parse_json(raw):
    if not raw:
        return None
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None


def _norm_box(item):
    keys = ("x1", "y1", "x2", "y2")
    if all(k in item for k in keys):
        return [float(item[k]) for k in keys]
    bbox = item.get("bbox")
    if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
        return [float(v) for v in bbox]
    return None


def normalize_regions(data, width, height):
    regions = []
    if not isinstance(data, dict):
        return regions
    for item in data.get("regions") or []:
        box = _norm_box(item)
        if not box:
            continue
        x1, y1, x2, y2 = box
        # 0-1 or 0-1000 or already pixels
        mx = max(x1, x2, y1, y2)
        if mx <= 1.5:
            scale_x, scale_y = width, height
        elif mx <= 1000.5:
            scale_x, scale_y = width / 1000.0, height / 1000.0
        else:
            scale_x, scale_y = 1.0, 1.0
        px = [x1 * scale_x, y1 * scale_y, x2 * scale_x, y2 * scale_y]
        if px[2] < px[0]:
            px[0], px[2] = px[2], px[0]
        if px[3] < px[1]:
            px[1], px[3] = px[3], px[1]
        if px[2] - px[0] < 4 or px[3] - px[1] < 4:
            continue
        text = (item.get("text") or "").strip()
        regions.append(
            {
                "box": px,
                "kind": (item.get("kind") or "dialogue").lower(),
                "source": (item.get("source") or "").strip(),
                "text": text,
                "erase_only": bool(item.get("erase_only")),
            }
        )
    return regions


def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(1, (ax2 - ax1) * (ay2 - ay1))
    area_b = max(1, (bx2 - bx1) * (by2 - by1))
    return inter / float(area_a + area_b - inter)


def merge_regions(regions, iou_thresh=0.3):
    """Üst üste binen kutuları birleştir (TR+EN kalıntısı tek balon olsun)."""
    items = list(regions)
    changed = True
    while changed:
        changed = False
        out = []
        used = [False] * len(items)
        for i, a in enumerate(items):
            if used[i]:
                continue
            acc = dict(a)
            acc["box"] = list(a["box"])
            for j, b in enumerate(items):
                if j <= i or used[j]:
                    continue
                if iou(acc["box"], b["box"]) < iou_thresh:
                    continue
                used[j] = True
                changed = True
                x1, y1, x2, y2 = acc["box"]
                bx = b["box"]
                acc["box"] = [min(x1, bx[0]), min(y1, bx[1]), max(x2, bx[2]), max(y2, bx[3])]
                if b.get("text") and len(b["text"]) > len(acc.get("text") or ""):
                    acc["text"] = b["text"]
                    acc["kind"] = b.get("kind", acc["kind"])
                if b.get("source") and len(b["source"]) > len(acc.get("source") or ""):
                    acc["source"] = b["source"]
                acc["erase_only"] = acc.get("erase_only") and b.get("erase_only")
            used[i] = True
            out.append(acc)
        items = out
    return items


def offset_regions(regions, dy=0, dx=0):
    out = []
    for r in regions:
        x1, y1, x2, y2 = r["box"]
        nr = dict(r)
        nr["box"] = [x1 + dx, y1 + dy, x2 + dx, y2 + dy]
        out.append(nr)
    return out


def has_llm_keys():
    from llm import has_keys
    return has_keys()


def detect_regions(image_bytes, mime="image/png"):
    """DeepSeek Vision ile bölgeler. Key yoksa None."""
    from llm import call_vision, has_keys

    if not has_keys():
        return None
    raw = call_vision(image_bytes, PROMPT, mime=mime, label="overlay")
    if not raw:
        return None
    data = _parse_json(raw)
    if data is None:
        print("      ⚠️ Overlay: JSON ayrıştırılamadı")
        return None
    return data
