import os
import re
import time
import requests
import undetected_chromedriver as uc
from sqlalchemy import create_engine, text
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from slugify import slugify
from dotenv import load_dotenv
from PIL import Image
from io import BytesIO
import json

# ==========================================
# ⚙️ AYARLAR
# ==========================================

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

import platform as _platform

# DB bağlantısı — .env dosyasından okunur (şifreler kodda OLMAMALI)
# BOT_DB_CONNECTION → Bot sunucuda direkt çalışırken (localhost:5433)
# DB_CONNECTION     → Docker içinde çalışırken (db:5432)
_raw_db = os.getenv("BOT_DB_CONNECTION") or os.getenv("DB_CONNECTION", "")

if not _raw_db:
    raise RuntimeError(
        "❌ Veritabanı bağlantısı bulunamadı!\n"
        "   .env dosyasına şunu ekle:\n"
        "   BOT_DB_CONNECTION=postgresql://kullanici:sifre@localhost:5433/webtoon_db"
    )

# Linux'ta Docker dışı çalışırken 'db' hostname'ini localhost:5433'e çevir
if _platform.system() == "Linux" and "@db:" in _raw_db:
    _raw_db = re.sub(r"@db:(\d+)", "@localhost:5433", _raw_db)
    print("⚠️  DB hostname 'db' → 'localhost:5433' olarak otomatik düzeltildi")

DB_CONNECTION = _raw_db
print(f"🔌 DB Bağlantısı: {DB_CONNECTION.split('@')[-1]}")


BASE_PATH = os.path.join(BACKEND_DIR, "static")
SERI_DOSYASI = os.path.join(CURRENT_DIR, "seriler.txt")
SERI_ARASI_BEKLEME = 5
TUR_ARASI_BEKLEME = 1800

engine = create_engine(DB_CONNECTION)

def get_chrome_version():
    """Yüklü Chrome sürümünü tespit et (Linux + Windows)."""
    import subprocess
    import platform

    system = platform.system()

    if system == "Linux":
        # Linux: google-chrome veya chromium komutlarını dene
        for cmd in ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]:
            try:
                result = subprocess.run(
                    [cmd, "--version"],
                    capture_output=True, text=True, timeout=5
                )
                match = re.search(r"(\d+)\.\d+\.\d+", result.stdout)
                if match:
                    major = int(match.group(1))
                    print(f"    🔍 Chrome versiyonu tespit edildi ({cmd}): {major}")
                    return major
            except Exception:
                continue

    elif system == "Windows":
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                 r"Software\Google\Chrome\BLBeacon")
            version, _ = winreg.QueryValueEx(key, "version")
            major = int(version.split(".")[0])
            print(f"    🔍 Chrome versiyonu tespit edildi (registry): {major}")
            return major
        except Exception:
            pass
        try:
            result = subprocess.run(
                ["reg", "query",
                 r"HKEY_LOCAL_MACHINE\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Google Chrome",
                 "/v", "DisplayVersion"],
                capture_output=True, text=True
            )
            match = re.search(r"(\d+)\.\d+\.\d+\.\d+", result.stdout)
            if match:
                major = int(match.group(1))
                print(f"    🔍 Chrome versiyonu tespit edildi (reg query): {major}")
                return major
        except Exception:
            pass

    print("    ⚠️ Chrome versiyonu tespit edilemedi, varsayılan kullanılıyor.")
    return None


def process_and_save_image(img_url, folder_path, file_name, cookies=None, referer=None):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': referer or 'https://manga-tr.com/',
        }
        response = requests.get(
            img_url, headers=headers,
            cookies=cookies or {},
            stream=True, timeout=20
        )
        if response.status_code == 200:
            if len(response.content) < 1000:
                return None
            try:
                image = Image.open(BytesIO(response.content))
                image.verify()
                image = Image.open(BytesIO(response.content))
            except Exception:
                return None
            if not os.path.exists(folder_path):
                os.makedirs(folder_path)
            full_path = os.path.join(folder_path, file_name)
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            image.save(full_path, "WEBP", quality=80)
            print(f"      ✅ Kaydedildi: {file_name}")
            relative_path = os.path.relpath(full_path, BACKEND_DIR)
            return relative_path.replace("\\", "/")
    except Exception as e:
        if "cannot identify" not in str(e):
            print(f"      ❌ Resim hatası: {e}")
    return None


class AutoBot:
    def __init__(self):
        options = uc.ChromeOptions()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--window-size=1280,900")
        options.add_argument("--disable-blink-features=AutomationControlled")

        chrome_version = get_chrome_version()

        try:
            if chrome_version:
                self.driver = uc.Chrome(options=options, version_main=chrome_version)
            else:
                self.driver = uc.Chrome(options=options)
            print("    ✅ Tarayıcı başlatıldı.")
        except Exception as e:
            print(f"❌ Tarayıcı başlatılamadı: {e}")
            raise

    def close(self):
        """Tarayıcıyı kapat ve RAM'i temizle."""
        try:
            if self.driver:
                self.driver.quit()
                self.driver = None
                print("    🧹 Tarayıcı kapatıldı, RAM temizlendi.")
        except Exception:
            pass

    def _detect_site(self, url):
        """URL'ye göre site tipini tespit et."""
        if "manga-tr.com" in url:
            return "manga-tr"
        return "generic"

    # -------------------------------------------------------
    # manga-tr.com için özel seri kontrolü
    # -------------------------------------------------------
    def check_manga_tr(self, target_url):
        print(f"\n🕵️ [{time.strftime('%H:%M:%S')}] [manga-tr] Kontrol: {target_url}")
        try:
            self.driver.get(target_url)
            time.sleep(5)

            # Başlık
            title = None
            for selector in ["h2.manga-baslik", "h1.manga-baslik", "h1", "h2"]:
                try:
                    el = self.driver.find_element(By.CSS_SELECTOR, selector)
                    title = el.text.strip()
                    if title:
                        break
                except Exception:
                    continue
            if not title:
                print("    ⚠️ Başlık bulunamadı, seri atlandı.")
                return
            print(f"    📖 Başlık: {title}")

            slug = slugify(title)

            # Kapak görseli  — meta itemprop="image" güvenilir
            cover_src = None
            try:
                cover_src = self.driver.execute_script(
                    "return document.querySelector('meta[itemprop=\"image\"]')?.content || '';"
                )
                if not cover_src:
                    raise ValueError
            except Exception:
                pass
            if not cover_src:
                for sel in [".manga-kapak img", ".summary_image img", ".thumb img", "img[src*='/cover']", "img[src*='/covers/']"]:
                    try:
                        el = self.driver.find_element(By.CSS_SELECTOR, sel)
                        cover_src = el.get_attribute("src")
                        if cover_src:
                            break
                    except Exception:
                        continue

            webtoon_id = self.sync_webtoon_info(title, slug, cover_src)

            # Bölüm listesi — sayfalı olabilir, tüm sayfaları gez
            site_chapters = self._get_manga_tr_chapters(target_url)

            existing_chapters = self.get_db_chapters(webtoon_id)
            new_chapters = [ch for ch in site_chapters if ch["num"] not in existing_chapters]

            if not new_chapters:
                print(f"    ✅ Durum: GÜNCEL. ({len(site_chapters)} bölüm var)")
            else:
                print(f"    🚀 {len(new_chapters)} YENİ BÖLÜM YAKALANDI!")
                for chap in reversed(new_chapters):
                    print(f"\n    ⬇️ İndiriliyor: Bölüm {chap['num']}")
                    self.download_chapter_manga_tr(chap["url"], webtoon_id, chap["num"], slug)

        except Exception as e:
            print(f"❌ Seri işlenirken hata: {e}")

    def _get_manga_tr_chapters(self, series_url):
        """manga-tr.com bölüm listesini tüm sayfalardan topla."""
        chapters = []

        # ── 1. Toplam sayfa sayısını tespit et ─────────────────────────────────
        # Önce data-page attribute'una bak, yoksa buton text içeriğine bak
        total_pages = self.driver.execute_script("""
            let max = 0;
            // Yöntem 1: data-page attribute
            document.querySelectorAll('ul.pagination1 a, .pagination a, .page-link').forEach(a => {
                let dp = parseInt(a.getAttribute('data-page'));
                if (!isNaN(dp) && dp > max) max = dp;
                // Yöntem 2: buton yazısı rakam ise
                let txt = parseInt(a.textContent.trim());
                if (!isNaN(txt) && txt > max) max = txt;
            });
            return max > 0 ? max : 1;
        """)
        print(f"    📑 Toplam {total_pages} sayfa tespit edildi.")

        page = 1
        while True:
            # Bu sayfadaki bölüm linklerini topla (duplicate'leri atla)
            chapter_links = self.driver.execute_script("""
                let seen = new Set();
                let chapters = [];
                document.querySelectorAll('a[href]').forEach(a => {
                    let href = a.href;
                    let match = href.match(/id-\\d+-read-[\\w-]+-chapter-([\\d.]+)\\.html/);
                    if (match && !seen.has(href)) {
                        seen.add(href);
                        chapters.push({ num: match[1], url: href });
                    }
                });
                return chapters;
            """)

            if not chapter_links:
                if page == 1:
                    print("    ⚠️ Bölüm listesi bulunamadı!")
                break

            existing_urls = {ch["url"] for ch in chapters}
            new_links = [ch for ch in chapter_links if ch["url"] not in existing_urls]
            chapters.extend(new_links)
            print(f"    📄 Sayfa {page}: {len(new_links)} yeni bölüm (toplam: {len(chapters)})")

            if page >= total_pages:
                break

            # ── Sonraki sayfaya geç ─────────────────────────────────────────────
            next_page = page + 1
            clicked = self.driver.execute_script(f"""
                // Yöntem 1: data-page={next_page} attribute
                let btn = document.querySelector(
                    'ul.pagination1 a[data-page="{next_page}"], .pagination a[data-page="{next_page}"]'
                );
                if (btn) {{ btn.click(); return true; }}
                // Yöntem 2: Text içeriği rakam olan buton
                let allBtns = document.querySelectorAll('ul.pagination1 a, .pagination a, .page-link');
                for (let b of allBtns) {{
                    if (b.textContent.trim() === '{next_page}') {{ b.click(); return true; }}
                }}
                // Yöntem 3: "Sonraki" / "Next" butonu
                for (let b of allBtns) {{
                    let t = b.textContent.toLowerCase().trim();
                    if (t === 'sonraki' || t === 'next' || t === '>') {{ b.click(); return true; }}
                }}
                return false;
            """)
            if not clicked:
                print(f"    ⚠️ Sayfa {next_page} butonu bulunamadı, durduruluyor.")
                break
            time.sleep(2)
            page += 1

        # Bölümleri sayısal sıraya koy (1, 2, 3 ... en son bölüm)
        chapters.sort(key=lambda x: float(x['num']))
        print(f"    📚 Toplam {len(chapters)} bölüm bulundu.")
        return chapters

    def _get_browser_cookies(self):
        """Selenium oturumundaki cookie'leri requests formatına çevir."""
        cookies = {}
        try:
            for c in self.driver.get_cookies():
                cookies[c['name']] = c['value']
        except Exception:
            pass
        return cookies

    def _fetch_image_via_browser(self, img_url):
        """Tarayıcı üzerinden resim indir — JavaScript fetch() ile (credentials dahil).
        requests.get() yerine bu kullanılır çünkü img_part.php oturuma bağli.
        """
        try:
            result = self.driver.execute_async_script("""
                var done = arguments[0];
                var url  = arguments[1];
                fetch(url, {credentials: 'include'})
                    .then(function(r) { return r.arrayBuffer(); })
                    .then(function(buf) {
                        var bytes = new Uint8Array(buf);
                        var binary = '';
                        for (var i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        done({ok: true, data: btoa(binary)});
                    })
                    .catch(function(e) { done({ok: false, error: e.toString()}); });
            """, img_url)
            if result and result.get('ok'):
                import base64
                return base64.b64decode(result['data'])
        except Exception as e:
            print(f"        ⚠️ fetch hatası: {e}")
        return None

    def _switch_to_page_mode(self):
        """Reader'ı 'Sayfadan Sayfaya' moduna geçir.
        Site varsayılan olarak 'Tümü' veya 'Webtoon' modunda açılıyor.
        'Sayfadan Sayfaya' modunda her sayfada 1 görsel var ve select dropdown ile gezilebiliyor.
        """
        try:
            # Önce ayarlar menüsünü aç (sağ üstteki dişli ikon)
            self.driver.execute_script(
                "var gear = document.querySelector('.reader-settings-btn, [class*=\"settings\"], .fa-cog');"
                "if (gear) gear.click();"
            )
            time.sleep(1)

            # 'Sayfadan Sayfaya' butonunu bul ve tıkla
            clicked = self.driver.execute_script(
                "var btns = Array.from(document.querySelectorAll('button, a, div'));"
                "var target = btns.find(function(b) {"
                "  var t = b.textContent.trim();"
                "  return t === 'Sayfadan Sayfaya' || t.toLowerCase().includes('sayfa');"
                "});"
                "if (target) { target.click(); return true; }"
                "return false;"
            )
            if clicked:
                time.sleep(2)
                print("      📖 'Sayfadan Sayfaya' modu aktif edildi.")
                return True
        except Exception as e:
            print(f"      ⚠️ Mod değiştirme hatası: {e}")
        return False

    def _get_page_image_urls_all_mode(self):
        """'Tümü' modunda açık sayfadaki tüm manga img URL'lerini topla.
        Blacklist ile UI ikonları vs. filtrelenir.
        """
        BLACKLIST = [
            '/yorum/', 'tenor.com', 'giphy.com', 'emoji', 'favicon',
            'avatar', 'logo', 'icon', 'banner', 'ads', 'pixel',
            'facebook', 'twitter', 'instagram', 'google',
        ]
        try:
            urls = self.driver.execute_script(
                "var BL = ['/yorum/','tenor.com','giphy.com','emoji','favicon',"
                "          'avatar','logo','icon','banner','ads','pixel','facebook','twitter'];"
                "function ok(src) {"
                "  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false;"
                "  var s = src.toLowerCase();"
                "  return !BL.some(function(b){return s.indexOf(b)!==-1;});"
                "}"
                "var seen = {}; var result = [];"
                "document.querySelectorAll('img').forEach(function(img) {"
                "  var src = img.getAttribute('data-src') || img.getAttribute('data-original') || img.src || '';"
                "  src = src.trim();"
                "  var area = (img.naturalWidth || parseInt(img.getAttribute('width')||'0'))"
                "           * (img.naturalHeight || parseInt(img.getAttribute('height')||'0'));"
                "  if (ok(src) && !seen[src] && area > 10000) {"
                "    seen[src] = true; result.push(src);"
                "  }"
                "});"
                "return result;"
            )
            return [u for u in (urls or []) if not any(b in u.lower() for b in BLACKLIST)]
        except Exception as e:
            print(f"      ⚠️ img URL toplama hatası: {e}")
            return []

    def download_chapter_manga_tr(self, url, webtoon_id, chap_num, series_slug):
        """manga-tr.com bölümünü indir.

        Strateji:
        1) Sayfayı yükle ve tüm içeriği lazy-load için yavaşça scroll et.
        2) Her .chapter-page için önce canvas.toDataURL() dene (retry ile).
        3) Canvas boşsa veya yoksa, .chapter-page içindeki <img> elementinin
           src/data-src adresini alıp fetch() ile tam byte'ı indir.
        4) İkisi de başarısız olursa o sayfayı atla.
        5) Screenshot KULLANMA — arkaplan/UI elementlerini kesiyor.
        """
        import base64

        def _canvas_to_b64(driver, page_index, retries=3):
            """Canvas içeriğini base64 PNG olarak al; boşsa None döndür."""
            for attempt in range(retries):
                b64 = driver.execute_script(f"""
                    var page = document.querySelectorAll('.chapter-page')[{page_index}];
                    if (!page) return null;
                    page.scrollIntoView({{behavior: 'instant', block: 'center'}});
                    var c = page.querySelector('canvas');
                    if (!c || c.width === 0 || c.height === 0) return null;
                    try {{
                        var data = c.toDataURL('image/png').split(',')[1];
                        return data || null;
                    }} catch(e) {{ return null; }}
                """)
                if b64:
                    # Boş/tek renk kontrol
                    try:
                        raw = base64.b64decode(b64)
                        img = Image.open(BytesIO(raw))
                        pixels = list(img.getdata())
                        if len(pixels) > 200 and not all(p == pixels[0] for p in pixels[:200]):
                            return b64
                    except Exception:
                        return b64  # parse edilemiyorsa raw'ı dön, dışarıda hata yakalanır
                # Henüz render olmamış olabilir, bekle
                time.sleep(1.5)
            return None

        def _get_img_url_in_page(driver, page_index):
            """Bir .chapter-page içindeki <img> elementinin gerçek URL'sini döndür."""
            return driver.execute_script(f"""
                var page = document.querySelectorAll('.chapter-page')[{page_index}];
                if (!page) return null;
                var img = page.querySelector('img');
                if (!img) return null;
                return img.getAttribute('data-src') || img.getAttribute('data-original')
                       || img.src || null;
            """)

        def _fetch_bytes(driver, img_url):
            """Tarayıcı fetch() ile resmi indir (cookie/session dahil). Bytes döndürür."""
            result = driver.execute_async_script("""
                var done = arguments[0];
                var url  = arguments[1];
                fetch(url, {credentials: 'include'})
                    .then(function(r) { return r.arrayBuffer(); })
                    .then(function(buf) {
                        var bytes = new Uint8Array(buf);
                        var binary = '';
                        for (var i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        done({ok: true, data: btoa(binary)});
                    })
                    .catch(function(e) { done({ok: false, error: e.toString()}); });
            """, img_url)
            if result and result.get('ok') and result.get('data'):
                return base64.b64decode(result['data'])
            return None

        try:
            # ── 1. Bölümü yükle ──────────────────────────────────────────────────
            self.driver.get(url)
            time.sleep(6)

            episode_folder = os.path.join(BASE_PATH, "images", series_slug, f"bolum-{chap_num}")
            saved_paths = []

            # ── 2. Tüm sayfaları lazy-load tetiklemek için scroll et ─────────────
            print(f"      📄 Lazy-load için sayfalar scroll ediliyor...")
            scroll_steps = 6
            for step in range(1, scroll_steps + 1):
                self.driver.execute_script(
                    f"window.scrollTo(0, document.body.scrollHeight * {step}/{scroll_steps});"
                )
                time.sleep(1.2)
            # Başa dön, render'ın tamamlanması için bekle
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(2)

            # ── 3. Sayfa sayısını tespit et ──────────────────────────────────────
            num_pages = self.driver.execute_script(
                "return document.querySelectorAll('.chapter-page').length;"
            )

            if num_pages == 0:
                print("      ⚠️ Hiçbir sayfa (.chapter-page) bulunamadı.")
                return

            print(f"      📄 Toplam {num_pages} sayfa tespit edildi.")

            # ── 4. Her sayfayı işle ───────────────────────────────────────────────
            for i in range(num_pages):
                fname = f"{series_slug}-bolum-{chap_num}-sayfa-{i+1}.webp"
                saved = None
                img_bytes = None

                # --- Yöntem A: Canvas ---
                b64_data = _canvas_to_b64(self.driver, i)
                if b64_data:
                    try:
                        img_bytes = base64.b64decode(b64_data)
                    except Exception as e:
                        print(f"      ⚠️ Canvas base64 decode hatası (sayfa {i+1}): {e}")

                # --- Yöntem B: <img> src'den fetch ---
                if not img_bytes:
                    img_url = _get_img_url_in_page(self.driver, i)
                    if img_url and img_url.startswith("http"):
                        print(f"      🌐 img fetch deneniyor (sayfa {i+1}): {img_url[:80]}")
                        # Önce browser fetch (session dahil)
                        img_bytes = _fetch_bytes(self.driver, img_url)
                        # Sonra requests ile dene
                        if not img_bytes:
                            try:
                                cookies = self._get_browser_cookies()
                                resp = requests.get(
                                    img_url,
                                    headers={
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                                        'Referer': url,
                                    },
                                    cookies=cookies,
                                    stream=True,
                                    timeout=20,
                                )
                                if resp.status_code == 200 and len(resp.content) > 1000:
                                    img_bytes = resp.content
                            except Exception as e:
                                print(f"      ⚠️ requests fallback hatası: {e}")

                # --- Kaydet ---
                if img_bytes:
                    try:
                        image = Image.open(BytesIO(img_bytes))
                        image.verify()
                        image = Image.open(BytesIO(img_bytes))

                        # Boyut kontrolü: çok küçük görseller (logo/ikon) atla
                        w, h = image.size
                        if w < 100 or h < 100:
                            print(f"      ⚠️ Sayfa {i+1} çok küçük ({w}x{h}), atlandı.")
                            continue

                        if image.mode in ("RGBA", "P"):
                            image = image.convert("RGB")

                        if not os.path.exists(episode_folder):
                            os.makedirs(episode_folder)
                        full_path = os.path.join(episode_folder, fname)
                        image.save(full_path, "WEBP", quality=85)
                        saved = os.path.relpath(full_path, BACKEND_DIR).replace("\\", "/")
                        print(f"      ✅ Kaydedildi ({w}x{h}): {fname}")
                    except Exception as e:
                        print(f"      ⚠️ Görsel işleme hatası (sayfa {i+1}): {e}")
                else:
                    print(f"      ❌ Sayfa {i+1}: Canvas ve img kaynağı bulunamadı, atlandı.")

                if saved:
                    saved_paths.append(saved)

            # ── 5. DB'ye kaydet ───────────────────────────────────────────────────
            if not saved_paths:
                print("      ⚠️ Hiçbir sayfa kaydedilemedi, bölüm atlanıyor.")
                return

            print(f"      🖼️ {len(saved_paths)} sayfa tamamlandı.")

            with engine.connect() as conn:
                check = conn.execute(
                    text("SELECT id FROM webtoon_episodes WHERE webtoon_id=:w AND episode_number=:e"),
                    {"w": webtoon_id, "e": chap_num}
                ).fetchone()
                if not check:
                    result = conn.execute(text("""
                        INSERT INTO webtoon_episodes (webtoon_id, episode_number, title, view_count, is_published, created_at)
                        VALUES (:w, :e, :t, 0, TRUE, NOW())
                        RETURNING id
                    """), {"w": webtoon_id, "e": chap_num, "t": f"Bölüm {chap_num}"})
                    episode_id = result.fetchone()[0]
                    for order, path in enumerate(saved_paths, start=1):
                        conn.execute(text("""
                            INSERT INTO episode_images (episode_id, image_url, page_order)
                            VALUES (:eid, :url, :ord)
                        """), {"eid": episode_id, "url": path, "ord": order})
                    conn.commit()
                    print(f"      ✅ DB'ye kaydedildi: {len(saved_paths)} sayfa")

        except Exception as e:
            print(f"      ❌ İndirme hatası: {e}")


    # -------------------------------------------------------
    # Genel (generic) seri kontrolü — eski mantık
    # -------------------------------------------------------
    def check_single_series(self, target_url):
        site = self._detect_site(target_url)
        if site == "manga-tr":
            return self.check_manga_tr(target_url)

        print(f"\n🕵️ [{time.strftime('%H:%M:%S')}] Kontrol ediliyor: {target_url}")
        try:
            self.driver.get(target_url)
            time.sleep(5)

            title = None
            for selector in ["h1", ".post-title h1", ".manga-title h1"]:
                try:
                    title = self.driver.find_element(By.CSS_SELECTOR, selector).text.strip()
                    if title:
                        break
                except Exception:
                    continue
            if not title:
                print("    ⚠️ Başlık bulunamadı, seri atlandı.")
                return

            slug = slugify(title)

            cover_src = None
            cover_selectors = [".summary_image img", ".c-image-hover img", ".wp-post-image", ".thumb img"]
            for sel in cover_selectors:
                try:
                    c = self.driver.find_element(By.CSS_SELECTOR, sel)
                    cover_src = c.get_attribute("src")
                    if cover_src:
                        break
                except Exception:
                    continue

            webtoon_id = self.sync_webtoon_info(title, slug, cover_src)

            site_chapters = []
            selector_strategies = [
                {"container": ".chapter-item", "link": "a.uk-link-toggle", "text_loc": "h3"},
                {"container": "#chapterlist li", "link": "a", "text_loc": ".chapternum"},
                {"container": "#chapterlist li", "link": "a", "text_loc": ""},
                {"container": "li.wp-manga-chapter", "link": "a", "text_loc": ""},
            ]

            found_items = []
            active_strategy = None
            for strategy in selector_strategies:
                items = self.driver.find_elements(By.CSS_SELECTOR, strategy["container"])
                if items:
                    found_items = items
                    active_strategy = strategy
                    print(f"    🔧 Site Yapısı: {strategy['container']} ({len(items)} Bölüm)")
                    break

            if not found_items:
                print("    ⚠️ HATA: Bölüm listesi bulunamadı!")
                return

            for item in found_items:
                try:
                    link_elem = item.find_element(By.CSS_SELECTOR, active_strategy["link"])
                    link = link_elem.get_attribute("href")
                    if active_strategy["text_loc"]:
                        try:
                            raw_text = item.find_element(By.CSS_SELECTOR, active_strategy["text_loc"]).text.strip()
                        except Exception:
                            raw_text = item.text.strip()
                    else:
                        raw_text = item.text.strip()
                        if not raw_text:
                            raw_text = link_elem.get_attribute("textContent").strip()
                    match = re.search(r"(\d+(\.\d+)?)", raw_text)
                    if match:
                        site_chapters.append({"num": match.group(1), "url": link})
                except Exception:
                    continue

            existing_chapters = self.get_db_chapters(webtoon_id)
            new_chapters = [ch for ch in site_chapters if ch["num"] not in existing_chapters]

            if not new_chapters:
                print(f"    ✅ Durum: GÜNCEL. ({len(site_chapters)} bölüm var)")
            else:
                print(f"    🚀 {len(new_chapters)} YENİ BÖLÜM YAKALANDI!")
                for chap in reversed(new_chapters):
                    print(f"\n    ⬇️ İndiriliyor: Bölüm {chap['num']}")
                    self.download_chapter(chap["url"], webtoon_id, chap["num"], slug)

        except Exception as e:
            print(f"❌ Seri işlenirken hata: {e}")

    def sync_webtoon_info(self, title, slug, cover_url):
        cover_path = ""
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT id FROM webtoons WHERE slug = :slug"),
                {"slug": slug}
            ).fetchone()
            if row:
                return row[0]
            if cover_url:
                cover_path = process_and_save_image(
                    cover_url,
                    os.path.join(BASE_PATH, "covers"),
                    f"{slug}-cover.webp"
                ) or ""
            ins = text("""
                INSERT INTO webtoons (title, slug, summary, cover_image, status, type, view_count, is_featured, is_published, created_at)
                VALUES (:t, :s, :sum, :c, 'ongoing', 'MANGA', 0, FALSE, TRUE, NOW())
                RETURNING id
            """)
            result = conn.execute(ins, {"t": title, "s": slug, "sum": f"{title} özeti", "c": cover_path})
            new_id = result.fetchone()[0]
            conn.commit()
            return new_id

    def get_db_chapters(self, webtoon_id):
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT episode_number FROM webtoon_episodes WHERE webtoon_id = :wid"),
                {"wid": webtoon_id}
            ).fetchall()
        return [str(int(row[0])) if row[0] % 1 == 0 else str(row[0]) for row in result]

    def download_chapter(self, url, webtoon_id, chap_num, series_slug):
        """Genel bölüm indirme (generic siteler için)."""
        try:
            self.driver.get(url)
            try:
                WebDriverWait(self.driver, 20).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "#readerarea img, .reading-content img"))
                )
            except Exception:
                pass
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight / 3);")
            time.sleep(2)

            image_urls = self.driver.execute_script("""
                let images = document.querySelectorAll('#readerarea img, .reading-content img, .entry-content img');
                let urls = [];
                images.forEach(img => {
                    let src = img.src || img.getAttribute('data-src') || img.getAttribute('data-url');
                    if (src && src.startsWith('http')) urls.push(src);
                });
                return urls;
            """)

            if not image_urls:
                print("      ⚠️ RESİM BULUNAMADI!")
                return

            episode_folder = os.path.join(BASE_PATH, "images", series_slug, f"bolum-{chap_num}")
            saved_paths = []
            for idx, src in enumerate(image_urls):
                fname = f"{series_slug}-bolum-{chap_num}-sahne-{idx+1}.webp"
                saved = process_and_save_image(src, episode_folder, fname)
                if saved:
                    saved_paths.append(saved)

            with engine.connect() as conn:
                check = conn.execute(
                    text("SELECT id FROM webtoon_episodes WHERE webtoon_id=:w AND episode_number=:e"),
                    {"w": webtoon_id, "e": chap_num}
                ).fetchone()
                if not check:
                    result = conn.execute(text("""
                        INSERT INTO webtoon_episodes (webtoon_id, episode_number, title, view_count, is_published, created_at)
                        VALUES (:w, :e, :t, 0, TRUE, NOW())
                        RETURNING id
                    """), {
                        "w": webtoon_id,
                        "e": chap_num,
                        "t": f"Bölüm {chap_num}",
                    })
                    episode_id = result.fetchone()[0]
                    for order, path in enumerate(saved_paths, start=1):
                        conn.execute(text("""
                            INSERT INTO episode_images (episode_id, image_url, page_order)
                            VALUES (:eid, :url, :ord)
                        """), {"eid": episode_id, "url": path, "ord": order})
                    conn.commit()
                    print(f"      ✅ DB'ye kaydedildi: {len(saved_paths)} sayfa")

        except Exception as e:
            print(f"      ❌ İndirme hatası: {e}")


def main():
    if not os.path.exists(SERI_DOSYASI):
        with open(SERI_DOSYASI, "w", encoding="utf-8") as f:
            f.write("# Her satıra bir URL ekle\n")
        print(f"📄 Seri dosyası oluşturuldu: {SERI_DOSYASI}")
        return

    print("🤖 OTO-PİLOT BAŞLATILDI!")
    while True:
        with open(SERI_DOSYASI, "r", encoding="utf-8") as f:
            urls = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]

        if urls:
            bot = None
            try:
                bot = AutoBot()
                for url in urls:
                    bot.check_single_series(url)
                    time.sleep(SERI_ARASI_BEKLEME)
            except Exception as e:
                print(f"❌ Bot ana döngüsünde hata: {e}")
            finally:
                if bot:
                    bot.close()
        else:
            print("📄 seriler.txt boş. URL ekleyip tekrar dene.")

        print(f"😴 Tur bitti. {TUR_ARASI_BEKLEME // 60} dakika bekleniyor...")
        time.sleep(TUR_ARASI_BEKLEME)


if __name__ == "__main__":
    main()
