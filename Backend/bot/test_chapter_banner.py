import os
import tempfile
import unittest

from PIL import Image

from chapter_banner import (
    BANNER_MARK,
    prepend_webtoon_banner,
    save_webtoon_banner,
    with_text_banner,
)


class TextBannerTests(unittest.TestCase):
    def test_prepends_once(self):
        out = with_text_banner("Merhaba bölüm")
        self.assertTrue(out.startswith(BANNER_MARK))
        self.assertIn("Merhaba bölüm", out)
        again = with_text_banner(out)
        self.assertEqual(again.count(BANNER_MARK), 1)

    def test_empty(self):
        out = with_text_banner("")
        self.assertIn(BANNER_MARK, out)


class WebtoonBannerTests(unittest.TestCase):
    def test_square_matches_page_width(self):
        with tempfile.TemporaryDirectory() as td:
            page = os.path.join(td, "sayfa-1.webp")
            Image.new("RGB", (900, 1400), (10, 10, 10)).save(page, "WEBP")
            paths = prepend_webtoon_banner(td, [page], backend_dir=td)
            self.assertEqual(len(paths), 2)
            banner = paths[0] if os.path.isabs(paths[0]) else os.path.join(td, paths[0])
            with Image.open(banner) as im:
                self.assertEqual(im.size[0], im.size[1])
                self.assertEqual(im.size[0], 900)
            self.assertEqual(len(prepend_webtoon_banner(td, paths, backend_dir=td)), 2)

    def test_save_clamps_min_width(self):
        with tempfile.TemporaryDirectory() as td:
            dest = save_webtoon_banner(td, page_width=100)
            self.assertTrue(dest and os.path.isfile(dest))
            with Image.open(dest) as im:
                self.assertGreaterEqual(im.size[0], 720)
                self.assertEqual(im.size[0], im.size[1])


if __name__ == "__main__":
    unittest.main()
