"""
typesetter.py — Profesyonel Manga Typesetting Modülü
====================================================
Çevrilmiş Türkçe metinleri manga balonlarına basar.
İşlem sırası:
  1. Balon bölgesini beyaza doldur (eski İngilizce metni sil)
  2. Akıllı satır kaydırma (Türkçe karaktere duyarlı)
  3. Dinamik font boyutu (taşmayı önle, balonu doldur)
  4. Metni balonun ortasına hizala
"""

import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Font Yapılandırması
# ──────────────────────────────────────────────────────────────
FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")

# Font öncelik sırası (ilk bulunan kullanılır)
FONT_CANDIDATES = [
    os.path.join(FONT_DIR, "Bangers-Regular.ttf"),   # Manga'ya en uygun
    os.path.join(FONT_DIR, "Teko-Bold.ttf"),          # Condensed, yer kazandırır
    os.path.join(FONT_DIR, "Oswald-Bold.ttf"),        # Alternatif
    os.path.join(FONT_DIR, "Oswald-Regular.ttf"),
]

# Sistem font fallback (hiçbir özel font yoksa)
SYSTEM_FONT_FALLBACKS = [
    "C:/Windows/Fonts/arialbd.ttf",      # Windows Arial Bold
    "C:/Windows/Fonts/calibrib.ttf",     # Windows Calibri Bold
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
]

_cached_font_path: Optional[str] = None


def _find_font_path() -> Optional[str]:
    """Kullanılabilir ilk font dosyasını bul."""
    global _cached_font_path
    if _cached_font_path:
        return _cached_font_path

    for path in FONT_CANDIDATES + SYSTEM_FONT_FALLBACKS:
        if os.path.exists(path):
            _cached_font_path = path
            logger.info(f"Font seçildi: {path}")
            return path

    logger.warning("Hiçbir özel font bulunamadı — PIL varsayılan fontu kullanılacak.")
    return None


def _load_font(size: int) -> ImageFont.ImageFont:
    """Verilen boyutta font yükle."""
    font_path = _find_font_path()
    if font_path:
        try:
            return ImageFont.truetype(font_path, size)
        except Exception as e:
            logger.warning(f"Font yükleme hatası ({font_path}): {e}")
    return ImageFont.load_default()


# ──────────────────────────────────────────────────────────────
# Yardımcı: Metni satırlara böl
# ──────────────────────────────────────────────────────────────
def _wrap_text(text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    """
    Metni verilen max_width piksel genişliğine sığacak şekilde satırlara böl.
    Türkçe karakterleri destekler.
    """
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip() if current_line else word
        try:
            bbox = font.getbbox(test_line)
            line_width = bbox[2] - bbox[0]
        except AttributeError:
            # Eski PIL sürümleri için
            line_width, _ = font.getsize(test_line)

        if line_width <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines if lines else [text]


# ──────────────────────────────────────────────────────────────
# Yardımcı: Dinamik font boyutu bul
# ──────────────────────────────────────────────────────────────
def _fit_font_size(
    text: str,
    max_width: int,
    max_height: int,
    max_size: int = 36,
    min_size: int = 8,
    padding: int = 8,
) -> tuple[ImageFont.ImageFont, list[str], int]:
    """
    Metni taşırmadan en büyük font boyutunu bul.
    
    Returns:
        (font, wrapped_lines, font_size)
    """
    usable_w = max_width  - padding * 2
    usable_h = max_height - padding * 2

    for size in range(max_size, min_size - 1, -1):
        font = _load_font(size)
        lines = _wrap_text(text, font, usable_w)

        # Toplam yüksekliği hesapla
        try:
            line_height = font.getbbox("Ay")[3] + 2   # 2px satır boşluğu
        except AttributeError:
            _, line_height = font.getsize("Ay")
            line_height += 2

        total_h = line_height * len(lines)

        if total_h <= usable_h:
            return font, lines, size

    # En küçük boyut bile sığmıyorsa — minimum fontu kullan
    font = _load_font(min_size)
    lines = _wrap_text(text, font, usable_w)
    return font, lines, min_size


# ──────────────────────────────────────────────────────────────
# Balon Temizleme: Eski metni beyaza boya
# ──────────────────────────────────────────────────────────────
def erase_bubble_content(
    image: Image.Image,
    region: dict,
    padding: int = 4,
) -> Image.Image:
    """
    Verilen bölgedeki eski metni beyaza doldur.
    Sadece beyaza yakın piksel alanlarını temizler (siyah çerçeveyi korur).

    region: {"x": int, "y": int, "w": int, "h": int}
    """
    img = image.copy()
    draw = ImageDraw.Draw(img)

    x, y, w, h = region["x"], region["y"], region["w"], region["h"]

    # İç alan (çerçeveyi korumak için padding ile içeri al)
    inner_x1 = x + padding
    inner_y1 = y + padding
    inner_x2 = x + w - padding
    inner_y2 = y + h - padding

    if inner_x2 <= inner_x1 or inner_y2 <= inner_y1:
        return img

    # OpenCV ile daha akıllı temizleme: Sadece açık pikselleri beyazla
    img_np = np.array(img.convert("RGB"))
    roi = img_np[inner_y1:inner_y2, inner_x1:inner_x2]

    # Açık pikselleri (200+) beyazla doldur, koyu pikselleri (çerçeve) bırak
    mask = np.all(roi > 150, axis=2)
    roi[mask] = [255, 255, 255]
    img_np[inner_y1:inner_y2, inner_x1:inner_x2] = roi

    return Image.fromarray(img_np)


# ──────────────────────────────────────────────────────────────
# Metin Basma: Balonun içine Türkçe metin yaz
# ──────────────────────────────────────────────────────────────
def draw_text_in_region(
    image: Image.Image,
    region: dict,
    text: str,
    text_color: tuple = (0, 0, 0),
    padding: int = 8,
    max_font_size: int = 34,
    min_font_size: int = 7,
    outline: bool = True,
    outline_color: tuple = (255, 255, 255),
    outline_width: int = 2,
) -> Image.Image:
    """
    Bölge içine metni dinamik font boyutuyla ortala ve yaz.

    region: {"x": int, "y": int, "w": int, "h": int}
    text: Türkçe metin
    """
    img = image.copy()
    draw = ImageDraw.Draw(img)

    x, y, w, h = region["x"], region["y"], region["w"], region["h"]

    # Metni taşırmadan en büyük font boyutunu bul
    font, lines, font_size = _fit_font_size(
        text, w, h,
        max_size=max_font_size,
        min_size=min_font_size,
        padding=padding,
    )

    # Toplam metin yüksekliği
    try:
        line_height = font.getbbox("Ay")[3] + 3
    except AttributeError:
        _, line_height = font.getsize("Ay")
        line_height += 3

    total_text_h = line_height * len(lines)

    # Dikey başlangıç noktası (ortala)
    text_y = y + (h - total_text_h) // 2

    for line in lines:
        # Yatay genişlik (ortala)
        try:
            bbox = font.getbbox(line)
            line_w = bbox[2] - bbox[0]
        except AttributeError:
            line_w, _ = font.getsize(line)

        text_x = x + (w - line_w) // 2

        # Outline/gölge (okunabilirlik için)
        if outline:
            for ox in range(-outline_width, outline_width + 1):
                for oy in range(-outline_width, outline_width + 1):
                    if ox != 0 or oy != 0:
                        draw.text((text_x + ox, text_y + oy), line,
                                  font=font, fill=outline_color)

        # Ana metin
        draw.text((text_x, text_y), line, font=font, fill=text_color)
        text_y += line_height

    return img


# ──────────────────────────────────────────────────────────────
# Ana Pipeline: Bir sayfayı tamamen tipset et
# ──────────────────────────────────────────────────────────────
def typeset_page(
    image_input,
    regions: list[dict],
    translations: list[str],
    skip_erase: bool = False,
) -> Image.Image:
    """
    Bir manga sayfasını komple tipset et.

    Args:
        image_input: PIL Image, bytes veya numpy array
        regions: OCR pipeline'dan gelen koordinatlar [{x, y, w, h, text}, ...]
        translations: Her bölge için Türkçe çeviri listesi
        skip_erase: True ise eski metin silme adımı atlanır (test için)

    Returns:
        Tipset edilmiş PIL Image
    """
    # Görüntüyü PIL'e çevir
    if isinstance(image_input, bytes):
        img = Image.open(BytesIO(image_input)).convert("RGB")
    elif isinstance(image_input, np.ndarray):
        img = Image.fromarray(cv2.cvtColor(image_input, cv2.COLOR_BGR2RGB))
    elif isinstance(image_input, Image.Image):
        img = image_input.convert("RGB")
    else:
        raise TypeError(f"Desteklenmeyen görüntü tipi: {type(image_input)}")

    if len(regions) != len(translations):
        logger.warning(
            f"Bölge sayısı ({len(regions)}) çeviri sayısıyla ({len(translations)}) eşleşmiyor!"
        )
        # Kısa olanı uzununa tamamla
        min_len = min(len(regions), len(translations))
        regions = regions[:min_len]
        translations = translations[:min_len]

    for region, turkish_text in zip(regions, translations):
        if not turkish_text or not turkish_text.strip():
            continue

        # 1. Balon içini beyaza boya
        if not skip_erase:
            img = erase_bubble_content(img, region, padding=5)

        # 2. Türkçe metni bas
        img = draw_text_in_region(
            img,
            region,
            turkish_text.strip(),
            text_color=(15, 15, 15),       # Siyaha yakın (tam siyah değil — daha doğal)
            outline=True,
            outline_color=(255, 255, 255),
            outline_width=2,
            max_font_size=34,
            min_font_size=7,
            padding=10,
        )

    return img


# ──────────────────────────────────────────────────────────────
# Görüntüyü WEBP olarak kaydet
# ──────────────────────────────────────────────────────────────
def save_typeset_image(img: Image.Image, output_path: str, quality: int = 88) -> str:
    """Tipset edilmiş görseli WEBP olarak kaydet."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    img.save(output_path, "WEBP", quality=quality)
    return output_path


# ──────────────────────────────────────────────────────────────
# Font indirme yardımcısı
# ──────────────────────────────────────────────────────────────
def download_fonts():
    """Gerekli fontları Google Fonts'tan indir."""
    import urllib.request

    os.makedirs(FONT_DIR, exist_ok=True)

    fonts = {
        "Bangers-Regular.ttf": (
            "https://github.com/google/fonts/raw/main/ofl/bangers/Bangers-Regular.ttf"
        ),
        "Teko-Bold.ttf": (
            "https://github.com/google/fonts/raw/main/ofl/teko/static/Teko-Bold.ttf"
        ),
        "Oswald-Bold.ttf": (
            "https://github.com/google/fonts/raw/main/ofl/oswald/static/Oswald-Bold.ttf"
        ),
    }

    for filename, url in fonts.items():
        dest = os.path.join(FONT_DIR, filename)
        if os.path.exists(dest):
            print(f"    ✅ Mevcut: {filename}")
            continue
        try:
            print(f"    ⬇️  İndiriliyor: {filename}...")
            urllib.request.urlretrieve(url, dest)
            print(f"    ✅ İndirildi: {filename}")
        except Exception as e:
            print(f"    ❌ Font indirme hatası ({filename}): {e}")


# ──────────────────────────────────────────────────────────────
# Test
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    print("🔤 Font indiriliyor...")
    download_fonts()

    # Test: Basit bir görüntü oluştur ve metin bas
    test_img = Image.new("RGB", (800, 1200), color=(200, 200, 200))

    test_regions = [
        {"x": 50, "y": 50, "w": 300, "h": 100, "text": "What the hell!"},
        {"x": 400, "y": 200, "w": 250, "h": 80, "text": "I'm sorry..."},
        {"x": 100, "y": 400, "w": 400, "h": 120, "text": "BOOM! That was incredible!"},
    ]

    test_translations = [
        "Ne halt ettin böyle!",
        "Özür dilerim...",
        "PANG! Bu inanılmazdı!",
    ]

    result = typeset_page(test_img, test_regions, test_translations, skip_erase=True)
    result.save("test_typeset_output.webp", "WEBP")
    print("✅ Test çıktısı: test_typeset_output.webp")
