import os

from PIL import ImageFont

from .ayar import bot_dir

_KIND_TO_KEY = {
    "dialogue": "diyalog",
    "diyalog": "diyalog",
    "thought": "dusunce",
    "dusunce": "dusunce",
    "narration": "anlatim",
    "anlatim": "anlatim",
    "ui": "ui",
    "sfx": "sfx",
    "bagirma": "bagirma",
    "shout": "bagirma",
    "yell": "bagirma",
    "scream": "bagirma",
}

_SYSTEM_FALLBACKS = [
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def _fonts_dir():
    return os.path.join(bot_dir(), "fonts")


def resolve_font_file(name):
    """Dosya adı veya mutlak yol → gerçek ttf yolu."""
    if not name:
        name = "ComicNeue-Bold.ttf"
    if os.path.isfile(name):
        return name
    bundled = os.path.join(_fonts_dir(), os.path.basename(name))
    if os.path.isfile(bundled):
        return bundled
    system = os.path.join("/usr/share/fonts/truetype/noto", os.path.basename(name))
    if os.path.isfile(system):
        return system
    for fb in _SYSTEM_FALLBACKS:
        if os.path.isfile(fb):
            return fb
    raise FileNotFoundError(f"Font bulunamadı: {name}")


def _mostly_upper(s):
    letters = [c for c in (s or "") if c.isalpha()]
    if len(letters) < 4:
        return False
    upper = sum(1 for c in letters if c.isupper())
    return upper / len(letters) >= 0.72


def looks_like_shout(text, source=""):
    """Bağırma: büyük harf haykırış veya birden fazla ünlem.

    Her 'Merhaba!' diyalogu bağırma değildir; UI/sistem yazısına da dokunma.
    """
    t = (text or "").strip()
    src = (source or "").strip()
    if _mostly_upper(src) or _mostly_upper(t):
        return True
    if t.count("!") >= 2 and len(t) <= 96:
        return True
    return False


def effective_kind(kind, text="", source=""):
    k = (kind or "diyalog").lower()
    if k in ("bagirma", "shout", "yell", "scream"):
        return "bagirma"
    if k in ("dialogue", "diyalog") and looks_like_shout(text, source):
        return "bagirma"
    return k


def font_for_kind(kind, ayar):
    key = _KIND_TO_KEY.get((kind or "diyalog").lower(), "diyalog")
    name = ayar.get("fontlar", {}).get(key) or "ComicNeue-Bold.ttf"
    return resolve_font_file(name)


def load_font(path, size):
    size = max(8, int(size))
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.truetype(resolve_font_file("NotoSans-Bold.ttf"), size)
