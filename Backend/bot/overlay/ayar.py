import json
import os

_BOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_PATH = os.path.join(_BOT_DIR, "overlay_ayar.json")

_DEFAULTS = {
    "aktif": True,
    "min_punto": 13,
    "max_punto": 64,
    "ic_bosluk": 0.11,
    "satir_araligi": 1.16,
    "ui_harf_araligi": 0.045,
    "kontur_orani": 0.0,
    "sfx_kontur_orani": 0.11,
    "bagirma_kontur_orani": 0.10,
    "yayilma_px": 26,
    "renk_esigi": 36,
    "birlestirme_iou": 0.30,
    "serit_max_yukseklik": 1700,
    "serit_ortusme": 150,
    "webp_kalite": 90,
    "sadece_kirli": False,
    "fontlar": {
        "diyalog": "ComicNeue-Bold.ttf",
        "dusunce": "ComicNeue-Bold.ttf",
        "anlatim": "NotoSans-Bold.ttf",
        "ui": "NotoSerif-Bold.ttf",
        "sfx": "NotoSansDisplay-Bold.ttf",
        "bagirma": "NotoSansDisplay-Bold.ttf",
    },
}


def load_ayar(path=None):
    """overlay_ayar.json oku; eksik anahtarları varsayılanla doldur."""
    ayar = dict(_DEFAULTS)
    ayar["fontlar"] = dict(_DEFAULTS["fontlar"])
    cfg_path = path or os.environ.get("OVERLAY_AYAR") or _DEFAULT_PATH
    if os.path.isfile(cfg_path):
        with open(cfg_path, encoding="utf-8") as f:
            raw = json.load(f)
        fonts = raw.pop("fontlar", None)
        ayar.update(raw)
        if isinstance(fonts, dict):
            ayar["fontlar"].update(fonts)
    if os.environ.get("OVERLAY_KAPALI") in ("1", "true", "True"):
        ayar["aktif"] = False
    return ayar


def bot_dir():
    return _BOT_DIR
