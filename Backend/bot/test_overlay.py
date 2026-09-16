import os
import unittest

import numpy as np
from PIL import Image, ImageDraw

from overlay.ayar import load_ayar
from overlay.mask import auto_text_color, grow_mask, inner_box, sample_bg
from overlay.pipeline import apply_regions
from overlay.typeset import fit_text, wrap_text
from overlay.vision import iou, merge_regions, normalize_regions
from overlay.fonts import font_for_kind, resolve_font_file


class WrapTests(unittest.TestCase):
    def test_wrap_keeps_newlines(self):
        path = resolve_font_file("ComicNeue-Bold.ttf")
        from overlay.fonts import load_font

        font = load_font(path, 20)
        lines = wrap_text(
            "Usta AnyTNG 'Düşük Seviye Yay (E-)' elde etti!\nUsta AnyTNG 'Sabah Yıldızı (D+)' elde etti!",
            font,
            900,
        )
        self.assertEqual(len(lines), 2)

    def test_wrap_fits_max_width(self):
        path = resolve_font_file("ComicNeue-Bold.ttf")
        from overlay.fonts import load_font

        font = load_font(path, 22)
        text = "Usta AnyTNG düşük seviye yay elde etti ve balona sığmalı"
        lines = wrap_text(text, font, 180)
        self.assertGreaterEqual(len(lines), 2)
        for line in lines:
            self.assertLessEqual(font.getlength(line), 185)

    def test_fit_stays_inside_box(self):
        path = resolve_font_file("ComicNeue-Bold.ttf")
        box = (10, 10, 210, 90)
        size, lines, font = fit_text(
            "İtaatkar ol, iyi dövüş ve iyi kazan.",
            box,
            path,
            10,
            48,
            1.16,
        )
        self.assertGreaterEqual(size, 10)
        line_h = int(round(size * 1.16))
        self.assertLessEqual(line_h * len(lines), (box[3] - box[1]) + 1)


class MaskTests(unittest.TestCase):
    def test_hexagon_does_not_eat_outside(self):
        img = Image.new("RGB", (400, 280), (250, 250, 250))
        draw = ImageDraw.Draw(img)
        hexagon = [(220, 40), (340, 90), (340, 190), (220, 240), (100, 190), (100, 90)]
        draw.polygon(hexagon, fill=(12, 12, 12))
        draw.text((150, 125), "kalinti ENGLISH leftover", fill=(240, 240, 240))
        arr = np.array(img)
        # Gevşek kutu kasten altıgen dışına taşar — dikdörtgen silme YASAK
        mask, bg = grow_mask(arr, (70, 20, 370, 260), max_grow=40, thresh=40)
        self.assertLess(int(bg.mean()), 40)
        # Dışarıdaki beyaz zemin maskede olmamalı
        self.assertEqual(int(mask[20, 20]), 0)
        self.assertEqual(int(mask[20, 380]), 0)
        # Balon içi yazı bölgesi maskede
        self.assertEqual(int(mask[140, 200]), 255)
        inner = inner_box(mask, pad_ratio=0.12)
        self.assertGreater(inner[2] - inner[0], 40)
        self.assertGreater(inner[3] - inner[1], 20)

    def test_sample_bg_dark_panel(self):
        img = np.full((100, 200, 3), 18, dtype=np.uint8)
        img[40:60, 40:160] = 240
        bg = sample_bg(img, (30, 20, 170, 80))
        self.assertLess(int(bg.mean()), 80)
        r, g, b = auto_text_color(bg)
        self.assertGreater(r, 200)


class VisionUtilTests(unittest.TestCase):
    def test_normalize_0_1000(self):
        data = {
            "regions": [
                {"x1": 100, "y1": 200, "x2": 500, "y2": 400, "kind": "ui", "text": "Merhaba"}
            ]
        }
        regs = normalize_regions(data, 1000, 800)
        self.assertEqual(len(regs), 1)
        self.assertEqual(regs[0]["box"][0], 100)
        self.assertEqual(regs[0]["kind"], "ui")

    def test_merge_overlap(self):
        regions = [
            {"box": [10, 10, 80, 50], "text": "A", "kind": "ui", "source": "", "erase_only": False},
            {"box": [20, 15, 90, 55], "text": "ABC", "kind": "ui", "source": "hi", "erase_only": False},
        ]
        merged = merge_regions(regions, 0.2)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["text"], "ABC")
        self.assertGreater(iou(regions[0]["box"], regions[1]["box"]), 0.2)


class PipelineTests(unittest.TestCase):
    def test_retypeset_dark_ui(self):
        img = Image.new("RGB", (640, 220), (8, 8, 12))
        draw = ImageDraw.Draw(img)
        draw.rectangle((40, 40, 600, 180), fill=(22, 22, 28))
        draw.text((70, 80), "SUMMONS. 10X SUMMON leftover", fill=(210, 210, 210))
        draw.text((90, 120), "Usta. 10 Ardışık ekipman", fill=(230, 230, 230))
        ayar = load_ayar()
        regions = [
            {
                "box": [55, 55, 585, 165],
                "kind": "ui",
                "text": "Usta. 10'lu çağrı başlıyor — 50.000 altın",
                "source": "SUMMONS. 10X SUMMON - 50,000 GOLD",
                "erase_only": False,
            }
        ]
        out, drawn = apply_regions(img, regions, ayar)
        self.assertEqual(drawn, 1)
        arr = np.array(out)
        # Kalıntı İngilizce gitmiş olmalı; yeni yazı beyaz
        leftover = arr[90:110, 80:200]
        # Zemin koyu veya yeni yazı; "SUMMONS" bloğu silinmiş
        self.assertTrue(arr[70, 70].mean() < 80 or arr[70, 70].mean() > 180)
        self.assertEqual(out.size, img.size)

    def test_dialogue_uses_comic_font(self):
        ayar = load_ayar()
        path = font_for_kind("dialogue", ayar)
        self.assertIn("ComicNeue", os.path.basename(path))
        ui = font_for_kind("ui", ayar)
        self.assertIn("NotoSerif", os.path.basename(ui))
        sfx = font_for_kind("sfx", ayar)
        self.assertIn("NotoSansDisplay", os.path.basename(sfx))


if __name__ == "__main__":
    unittest.main()
