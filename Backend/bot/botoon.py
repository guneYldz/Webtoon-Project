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
        """manga-tr.com bölüm listesini AJAX sayfalama ile tüm sayfalardan topla."""
        chapters = []

        # Sayfa zaten yüklü (check_manga_tr'den geliyoruz)
        # Toplam sayfa sayısını data-page attribute'larından al
        total_pages = self.driver.execute_script("""
            let btns = document.querySelectorAll('ul.pagination1 a[data-page], .pagination a[data-page]');
            let max = 0;
            btns.forEach(a => {
                let p = parseInt(a.getAttribute('data-page'));
                if (!isNaN(p) && p > max) max = p;
            });
            return max || 1;
        """)
        print(f"    📑 Toplam {total_pages} sayfa tespit edildi.")

        for page in range(1, total_pages + 1):
            if page > 1:
                # AJAX ile sayfa yükleme — data-page butonuna tıkla
                clicked = self.driver.execute_script(f"""
                    let btn = document.querySelector('ul.pagination1 a[data-page="{page}"], .pagination a[data-page="{page}"]');
                    if (btn) {{ btn.click(); return true; }}
                    return false;
                """)
                if not clicked:
                    print(f"    ⚠️ Sayfa {page} butonu bulunamadı, durduruluyor.")
                    break
                time.sleep(2)  # AJAX yanıtını bekle

            # Bu sayfadaki bölüm linklerini topla
            chapter_links = self.driver.execute_script("""
                let links = document.querySelectorAll('a[href]');
                let chapters = [];
                links.forEach(a => {
                    let href = a.href;
                    let match = href.match(/id-\\d+-read-[\\w-]+-chapter-([\\d.]+)\\.html/);
                    if (match) {
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
            print(f"    📄 Sayfa {page}/{total_pages}: {len(new_links)} bölüm (toplam: {len(chapters)})")

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

    def download_chapter_manga_tr(self, url, webtoon_id, chap_num, series_slug):
        """manga-tr.com okuma sayfasından görselleri indir.
        - Reader sayfalı: her sayfada img_part.php tile'ları var
        - DOM'dan tam yüklenmiş img'leri bekle → requests.get() ile indir → stitch
        """
        try:
            self.driver.get(url)
            time.sleep(4)

            # Toplam sayfa sayısını tespit et ("1/5" formatından)
            total_pages = self.driver.execute_script("""
                let m = document.body.innerText.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
                if (m) return parseInt(m[2]);
                let inp = document.querySelector('input[type="number"]');
                if (inp && inp.max) return parseInt(inp.max);
                return 1;
            """)
            print(f"      📄 Toplam {total_pages} sayfa.")

            browser_cookies = self._get_browser_cookies()
            episode_folder = os.path.join(BASE_PATH, "images", series_slug, f"bolum-{chap_num}")
            saved_paths = []
            seen_urls = set()

            for page_num in range(1, total_pages + 1):
                # DOM'da veya performance loglarında img_part.php yüklenene kadar bekle (max 20sn)
                tile_urls = []
                for attempt in range(10):
                    tile_urls = self.driver.execute_script("""
                        let urls = new Set();
                        // 1) DOM'dan kontrol et (lazy-load data-src dahil)
                        document.querySelectorAll('img').forEach(img => {
                            let src = img.src || img.getAttribute('data-src') || '';
                            if (src.includes('img_part.php')) {
                                urls.add(src);
                            }
                        });
                        
                        // 2) Performance API'dan kontrol et (Daha garantili)
                        performance.getEntriesByType('resource').forEach(e => {
                            if (e.name.includes('img_part.php')) {
                                urls.add(e.name);
                            }
                        });
                        
                        return Array.from(urls);
                    """)
                    
                    # Daha önce görülmemiş URL'leri filtrele
                    tile_urls = [u for u in tile_urls if u not in seen_urls]
                    if tile_urls:
                        break
                    time.sleep(2)

                print(f"      🔲 Sayfa {page_num}/{total_pages}: {len(tile_urls)} tile")
                seen_urls.update(tile_urls)

                if tile_urls:
                    tile_images = []
                    for t_url in tile_urls:
                        try:
                            resp = requests.get(
                                t_url,
                                headers={
                                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                                    'Referer': url,
                                },
                                cookies=browser_cookies,
                                timeout=30
                            )
                            if resp.status_code == 200 and len(resp.content) > 500:
                                img = Image.open(BytesIO(resp.content))
                                if img.mode in ("RGBA", "P"):
                                    img = img.convert("RGB")
                                tile_images.append(img)
                        except Exception:
                            continue

                    if tile_images:
                        # Tile'ları dikey birleştir → tek manga sayfası
                        total_w = max(i.width for i in tile_images)
                        total_h = sum(i.height for i in tile_images)
                        merged = Image.new("RGB", (total_w, total_h), (255, 255, 255))
                        y_off = 0
                        for ti in tile_images:
                            merged.paste(ti, (0, y_off))
                            y_off += ti.height

                        if not os.path.exists(episode_folder):
                            os.makedirs(episode_folder)

                        fname = f"{series_slug}-bolum-{chap_num}-sayfa-{page_num}.webp"
                        full_path = os.path.join(episode_folder, fname)
                        merged.save(full_path, "WEBP", quality=85)
                        relative = os.path.relpath(full_path, BACKEND_DIR).replace("\\", "/")
                        saved_paths.append(relative)
                        print(f"      ✅ Sayfa {page_num} kaydedildi: {fname}")

                # Sonraki sayfaya geç
                if page_num < total_pages:
                    self.driver.execute_script("""
                        let btn = document.querySelector(
                            'a[title="Sonraki Sayfa"], .next-page, .reader-nav-btn:last-of-type'
                        );
                        if (btn) { btn.click(); return; }
                        document.dispatchEvent(new KeyboardEvent('keydown',
                            {key:'ArrowRight', keyCode:39, bubbles:true}));
                    """)
                    time.sleep(3)

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
