"""python -m overlay --gorsel sayfa.webp --cikti out.webp"""

import argparse
import json
import os
import sys

from .ayar import load_ayar
from .pipeline import process_image
from .vision import merge_regions, normalize_regions


def _iter_images(root):
    exts = {".webp", ".png", ".jpg", ".jpeg"}
    for dirpath, _, files in os.walk(root):
        for name in sorted(files):
            if os.path.splitext(name)[1].lower() in exts:
                yield os.path.join(dirpath, name)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Manga overlay: kalıntıyı sil, Türkçe metni doğru fontla balona diz."
    )
    parser.add_argument("--gorsel", help="Tek görsel yolu")
    parser.add_argument("--cikti", help="Çıktı yolu (tek görsel)")
    parser.add_argument("--klasor", help="Klasördeki tüm sayfaları işle")
    parser.add_argument("--json", dest="json_path", help="Hazır bölgeler JSON")
    parser.add_argument("--ayar", help="overlay_ayar.json yolu")
    args = parser.parse_args(argv)

    ayar = load_ayar(args.ayar)
    regions = None
    if args.json_path:
        with open(args.json_path, encoding="utf-8") as f:
            data = json.load(f)
        # pixel boxes allowed; normalize later per image
        regions = data

    if args.gorsel:
        ready = None
        if regions is not None:
            img_w = img_h = None
            from PIL import Image

            with Image.open(args.gorsel) as im:
                img_w, img_h = im.size
            if isinstance(regions, dict) and "regions" in regions:
                ready = merge_regions(normalize_regions(regions, img_w, img_h))
            elif isinstance(regions, list):
                ready = merge_regions(normalize_regions({"regions": regions}, img_w, img_h))
        dest, n = process_image(args.gorsel, ayar=ayar, regions=ready, out_path=args.cikti)
        print(f"OK {dest} ({n} metin)")
        return 0

    if args.klasor:
        count = 0
        for path in _iter_images(args.klasor):
            dest, n = process_image(path, ayar=ayar)
            print(f"OK {dest} ({n} metin)")
            count += 1
        if count == 0:
            print("Klasörde görsel yok.")
            return 1
        return 0

    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
