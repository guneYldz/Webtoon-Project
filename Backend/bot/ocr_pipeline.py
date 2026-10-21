"""
ocr_pipeline.py — Manga Balon Tespiti ve OCR Modülü
=====================================================
RTX 5070 GPU desteğiyle EasyOCR kullanır.
OpenCV ile beyaz/siyah balon alanlarını tespit eder,
her balonun koordinatlarını ve içindeki metni döndürür.
"""

import cv2
import numpy as np
from PIL import Image
from io import BytesIO
import easyocr
from typing import Optional
import logging
import os

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# EasyOCR reader — Singleton (her çağrıda yeniden yüklenmez)
# ──────────────────────────────────────────────────────────────
_reader: Optional[easyocr.Reader] = None


def _get_reader() -> easyocr.Reader:
    """EasyOCR reader'ı yükle (ilk çağrıda GPU'ya yükler, sonraki hızlıdır)."""
    global _reader
    if _reader is None:
        logger.info("🧠 EasyOCR modeli GPU'ya yükleniyor... (ilk seferde ~30 sn)")
        print("    🧠 EasyOCR modeli GPU'ya yükleniyor (ilk seferinde ~30 sn)...")
        _reader = easyocr.Reader(
            ["en"],
            gpu=True,          # RTX 5070 — CUDA aktif
            verbose=False,
            model_storage_directory=os.path.join(
                os.path.dirname(__file__), ".easyocr_models"
            ),
        )
        print("    ✅ EasyOCR hazır.")
    return _reader


# ──────────────────────────────────────────────────────────────
# Yardımcı: Görüntüyü numpy array'e çevir
# ──────────────────────────────────────────────────────────────
def _to_numpy(image_input) -> np.ndarray:
    """PIL Image, bytes veya numpy array → BGR numpy array."""
    if isinstance(image_input, np.ndarray):
        return image_input
    if isinstance(image_input, bytes):
        arr = np.frombuffer(image_input, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if isinstance(image_input, Image.Image):
        rgb = np.array(image_input.convert("RGB"))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    raise TypeError(f"Desteklenmeyen görüntü tipi: {type(image_input)}")


# ──────────────────────────────────────────────────────────────
# Yardımcı: BBox'ları merge et (çok küçük parçaları birleştir)
# ──────────────────────────────────────────────────────────────
def _merge_nearby_boxes(boxes: list[dict], gap: int = 20) -> list[dict]:
    """Birbirine yakın bounding box'ları tek bir büyük box'a birleştir."""
    if not boxes:
        return boxes

    merged = True
    result = boxes[:]

    while merged:
        merged = False
        new_result = []
        used = [False] * len(result)

        for i, b1 in enumerate(result):
            if used[i]:
                continue
            x1, y1, w1, h1 = b1["x"], b1["y"], b1["w"], b1["h"]
            for j, b2 in enumerate(result):
                if i == j or used[j]:
                    continue
                x2, y2, w2, h2 = b2["x"], b2["y"], b2["w"], b2["h"]
                # Yakınlık kontrolü
                if (
                    abs(x1 - x2) < w1 + gap
                    and abs(y1 - y2) < h1 + gap
                ):
                    nx = min(x1, x2)
                    ny = min(y1, y2)
                    nw = max(x1 + w1, x2 + w2) - nx
                    nh = max(y1 + h1, y2 + h2) - ny
                    result[i] = {"x": nx, "y": ny, "w": nw, "h": nh,
                                 "text": b1.get("text", "") + " " + b2.get("text", ""),
                                 "confidence": min(b1.get("confidence", 1.0), b2.get("confidence", 1.0))}
                    x1, y1, w1, h1 = nx, ny, nw, nh
                    used[j] = True
                    merged = True
            new_result.append(result[i])
            used[i] = True
        result = new_result

    return result


# ──────────────────────────────────────────────────────────────
# Ana Fonksiyon: Sayfadaki tüm metin bölgelerini tespit et
# ──────────────────────────────────────────────────────────────
def detect_text_regions(image_input, min_conf: float = 0.3) -> list[dict]:
    """
    Manga sayfasındaki metin bölgelerini tespit et.

    Döndürdüğü liste:
    [
        {
            "x": int,           # sol kenar
            "y": int,           # üst kenar
            "w": int,           # genişlik
            "h": int,           # yükseklik
            "text": str,        # İngilizce metin
            "confidence": float # güven skoru (0-1)
        },
        ...
    ]
    """
    img_bgr = _to_numpy(image_input)
    reader = _get_reader()

    # EasyOCR ile tüm sayfayı tara
    try:
        results = reader.readtext(
            img_bgr,
            detail=1,
            paragraph=False,        # tek tek box — koordinat hassasiyeti için
            min_size=10,
            text_threshold=0.5,
            low_text=0.3,
            width_ths=0.7,
            contrast_ths=0.1,
            add_margin=0.1,
        )
    except Exception as e:
        logger.error(f"EasyOCR hatası: {e}")
        return []

    regions = []
    for bbox, text, conf in results:
        if conf < min_conf:
            continue
        text = text.strip()
        if not text or len(text) < 2:
            continue

        # EasyOCR bbox formatı: [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
        pts = np.array(bbox, dtype=np.int32)
        x = int(pts[:, 0].min())
        y = int(pts[:, 1].min())
        w = int(pts[:, 0].max()) - x
        h = int(pts[:, 1].max()) - y

        regions.append({
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "text": text,
            "confidence": float(conf),
        })

    # Yakın bölgeleri birleştir (aynı balon içindeki satırlar)
    regions = _merge_nearby_boxes(regions, gap=15)

    logger.debug(f"Tespit edilen bölge sayısı: {len(regions)}")
    return regions


# ──────────────────────────────────────────────────────────────
# Balon Tespiti: OpenCV ile beyaz balonları bul
# ──────────────────────────────────────────────────────────────
def detect_speech_bubbles(image_input) -> list[dict]:
    """
    OpenCV ile sayfadaki konuşma balonlarını tespit et.
    Beyaz dolgulu, siyah kenarlı balonları arar.

    Döndürdüğü liste:
    [
        {"x": int, "y": int, "w": int, "h": int, "area": float}
    ]
    """
    img_bgr = _to_numpy(image_input)
    h_img, w_img = img_bgr.shape[:2]

    # Gri tonlamaya çevir
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # Eşik: Beyaz alan (230+) — balonlar genellikle beyaz
    _, thresh = cv2.threshold(gray, 230, 255, cv2.THRESH_BINARY)

    # Gürültüyü temizle
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Konturları bul
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    bubbles = []
    min_area = (w_img * h_img) * 0.002   # Resmin %0.2'sinden küçük olanları at
    max_area = (w_img * h_img) * 0.6     # %60'tan büyük olanları at (arka plan)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue

        x, y, w, h = cv2.boundingRect(cnt)

        # Oran kontrolü: Çok uzun veya çok ince olanları atla
        ratio = w / h if h > 0 else 0
        if ratio < 0.2 or ratio > 8:
            continue

        # Doluluk kontrolü: Balon içi yeterince beyaz mı?
        roi = cleaned[y : y + h, x : x + w]
        white_ratio = np.sum(roi == 255) / roi.size
        if white_ratio < 0.5:
            continue

        bubbles.append({"x": x, "y": y, "w": w, "h": h, "area": float(area)})

    # Büyükten küçüğe sırala
    bubbles.sort(key=lambda b: b["area"], reverse=True)
    return bubbles


# ──────────────────────────────────────────────────────────────
# Birleşik Pipeline: OCR + Balon Eşleştirme
# ──────────────────────────────────────────────────────────────
def run_ocr_pipeline(image_input) -> list[dict]:
    """
    Tam OCR pipeline'ı:
    1. Metin bölgelerini tespit et (EasyOCR)
    2. Her metin bölgesini en yakın balona eşleştir
    3. Birleşik sonuçları döndür

    Döndürdüğü liste:
    [
        {
            "x", "y", "w", "h": Balon koordinatları (typesetting için)
            "text": str,         İngilizce metin
            "confidence": float  OCR güven skoru
        }
    ]
    """
    # Metinleri tespit et
    text_regions = detect_text_regions(image_input, min_conf=0.25)
    if not text_regions:
        return []

    # Balonları tespit et
    bubbles = detect_speech_bubbles(image_input)

    # Eğer hiç balon tespit edilemezse, OCR koordinatlarını direkt kullan
    if not bubbles:
        logger.debug("Balon tespit edilemedi — OCR koordinatları direkt kullanılıyor.")
        return text_regions

    # Her metin bölgesini en çok overlap eden balona eşleştir
    def _overlap(r1, r2):
        """İki dikdörtgenin kesişim alanı."""
        ix = max(0, min(r1["x"] + r1["w"], r2["x"] + r2["w"]) - max(r1["x"], r2["x"]))
        iy = max(0, min(r1["y"] + r1["h"], r2["y"] + r2["h"]) - max(r1["y"], r2["y"]))
        return ix * iy

    result = []
    for region in text_regions:
        best_bubble = None
        best_overlap = 0
        for bubble in bubbles:
            ov = _overlap(region, bubble)
            if ov > best_overlap:
                best_overlap = ov
                best_bubble = bubble

        if best_bubble and best_overlap > 0:
            # Balon koordinatlarını kullan (daha geniş alan → daha iyi typesetting)
            result.append({
                "x": best_bubble["x"],
                "y": best_bubble["y"],
                "w": best_bubble["w"],
                "h": best_bubble["h"],
                "text": region["text"],
                "confidence": region["confidence"],
            })
        else:
            # Balon bulunamadı — OCR koordinatını kullan
            result.append(region)

    return result


# ──────────────────────────────────────────────────────────────
# Debug: Tespit edilen bölgeleri görselleştir
# ──────────────────────────────────────────────────────────────
def debug_visualize(image_input, regions: list[dict], output_path: str):
    """Tespit edilen bölgeleri renkli dikdörtgenlerle çiz ve kaydet (debug için)."""
    img = _to_numpy(image_input).copy()
    for r in regions:
        cv2.rectangle(img, (r["x"], r["y"]), (r["x"] + r["w"], r["y"] + r["h"]),
                      (0, 255, 0), 2)
        label = r.get("text", "")[:20]
        cv2.putText(img, label, (r["x"], max(0, r["y"] - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
    cv2.imwrite(output_path, img)
    print(f"    🔍 Debug görsel kaydedildi: {output_path}")
