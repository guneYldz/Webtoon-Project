import re
from typing import Union


def clean_chapter_number(number) -> Union[int, float]:
    """1.0 -> 1 (int), 12.5 -> 12.5 (float) for clean JSON serialization."""
    if number is None:
        return 0
    try:
        n = float(number)
    except (TypeError, ValueError):
        return 0
    if n.is_integer():
        return int(n)
    return n


def format_chapter_number(number) -> str:
    """1.0 → '1', 1.5 → '1.5'."""
    try:
        n = float(number)
    except (TypeError, ValueError):
        return str(number or "").strip()
    if n.is_integer():
        return str(int(n))
    return f"{n:g}"


def default_chapter_title(raw, number) -> str:
    """Boş, sadece sayı veya '#1' ise 'Bölüm n' kaydet (bot ile aynı stil)."""
    n = format_chapter_number(number)
    expected = f"Bölüm {n}"
    text = (raw or "").strip()
    if not text:
        return expected
    if re.fullmatch(r"#?\s*\d+(\.\d+)?", text):
        return expected
    return text


def chapter_display_label(raw, number) -> str:
    """Bildirim ve yorumlarda gösterilecek etiket."""
    n = format_chapter_number(number)
    text = (raw or "").strip()
    if not text:
        return f"Bölüm {n}"
    if re.match(rf"^Bölüm\s+{re.escape(n)}\b", text, flags=re.IGNORECASE):
        return text
    if re.fullmatch(r"#?\s*\d+(\.\d+)?", text):
        return f"Bölüm {n}"
    return f"Bölüm {n} - {text}"
