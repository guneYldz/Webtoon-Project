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
