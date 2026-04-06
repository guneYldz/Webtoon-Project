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


# DB bağlantısı:
#   BOT_DB_CONNECTION → Docker dışında çalışırken (localhost:5433)
#   DB_CONNECTION     → Docker içinde çalışırken (db:5432)
_raw_db = (
    os.getenv("BOT_DB_CONNECTION")
    or os.getenv("DB_CONNECTION", "postgresql://webtoon_admin:Hn4moZSWvtV6Qswj@localhost:5433/webtoon_db")
)
# Docker içi 'db' hostname'ini localhost:5433 ile değiştir (bare-metal fallback)
if "@db:" in _raw_db:
    import platform
    if platform.system() == "Linux":
        _raw_db = _raw_db.replace("@db:5432", "@localhost:5433")
        print(f"⚠️  DB hostname 'db' → 'localhost:5433' olarak değiştirildi (bare-metal modu)")
DB_CONNECTION = _raw_db


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


def process_and_save_image(img_url, folder_path, file_name):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://manga-tr.com/',
        }
        response = requests.get(img_url, headers=headers, stream=True, timeout=20)
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
        page = 1

        # Kaç sayfa var?
        # URL önce yüklenmiş durumda, sadece sayfa numaralarını çekeceğiz
        base_url = series_url.rstrip("/")

        while True:
            if page == 1:
                page_url = base_url
            else:
                # manga-tr sayfa yapısı: ?sayfa=2 veya #page=2 veya /page/2/
                # URL yapısına göre dene
                page_url = f"{base_url}?sayfa={page}"

            try:
                self.driver.get(page_url)
                time.sleep(3)
            except Exception as e:
                print(f"    ⚠️ Sayfa {page} yüklenemedi: {e}")
                break

            # Bölüm linklerini topla
            chapter_links = self.driver.execute_script("""
                let links = document.querySelectorAll('a[href]');
                let chapters = [];
                links.forEach(a => {
                    let href = a.href;
                    // manga-tr chapter URL formatı: id-XXXXX-read-slug-chapter-NUM.html
                    let match = href.match(/id-\\d+-read-[\\w-]+-chapter-([\\d.]+)\\.html/);
                    if (match) {
                        chapters.push({ num: match[1], url: href });
                    }
                });
                return chapters;
            """)

            if not chapter_links:
                if page == 1:
                    print("    ⚠️ Bölüm listesi bulunamadı! Alternatif selector deneniyor...")
                    # Alternatif: tüm linkleri logla
                    all_links = self.driver.execute_script("""
                        return Array.from(document.querySelectorAll('a[href]'))
                            .map(a => a.href)
                            .filter(h => h.includes('read') || h.includes('bolum') || h.includes('chapter'))
                            .slice(0, 10);
                    """)
                    print(f"    🔎 Bulunan read linkleri: {all_links}")
                break

            # Yinelenen URL'leri filtrele
            existing_urls = {ch["url"] for ch in chapters}
            new_links = [ch for ch in chapter_links if ch["url"] not in existing_urls]

            if not new_links:
                # Yeni bölüm gelmedi, sayfalama bitti
                break

            chapters.extend(new_links)
            print(f"    📄 Sayfa {page}: {len(new_links)} bölüm bulundu (toplam: {len(chapters)})")

            # Sonraki sayfa butonu var mı?
            has_next = self.driver.execute_script("""
                // Sayfalama: .next, [rel=next], aria-label="Sonraki" gibi
                let next = document.querySelector('a.next, a[rel="next"], .pagination .next a, li.next a');
                return next ? next.href : null;
            """)

            if not has_next:
                break

            page += 1
            if page > 50:  # güvenlik sınırı
                break

        print(f"    📚 Toplam {len(chapters)} bölüm bulundu.")
        return chapters

    def download_chapter_manga_tr(self, url, webtoon_id, chap_num, series_slug):
        """manga-tr.com okuma sayfasından görselleri indir."""
        try:
            self.driver.get(url)

            # Dinamik resimler için img_part.php çağrılarını bekle
            # Önce #readerarea veya benzeri konteynerin dolmasını bekle
            try:
                WebDriverWait(self.driver, 20).until(
                    lambda d: len(d.find_elements(By.CSS_SELECTOR, "img[src], img[data-src]")) > 0
                )
            except Exception:
                pass

            # Yavaşça scroll yap — lazy load için
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(2)

            scroll_height = self.driver.execute_script("return document.body.scrollHeight;")
            step = 300
            current = 0
            while current < scroll_height:
                self.driver.execute_script(f"window.scrollTo(0, {current});")
                time.sleep(0.3)
                current += step
                scroll_height = self.driver.execute_script("return document.body.scrollHeight;")

            time.sleep(3)

            # Görselleri topla — geniş selector listesi
            image_urls = self.driver.execute_script("""
                let selectors = [
                    '#readerarea img',
                    '.reading-content img',
                    '.chapter-content img',
                    '.entry-content img',
                    '.reader-content img',
                    '#content img',
                    '.manga-reader img',
                    'img[src*="mangatr.site"]',
                    'img[src*="img_part"]',
                    'img[data-src*="mangatr.site"]',
                    'img[data-src]',
                ];
                let seen = new Set();
                let urls = [];
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(img => {
                        let src = img.src || img.getAttribute('data-src') || img.getAttribute('data-url') || '';
                        if (src && src.startsWith('http') && !seen.has(src)) {
                            seen.add(src);
                            urls.push(src);
                        }
                    });
                });
                return urls;
            """)

            # manga-tr: img_part.php proxy üzerinden geliyor
            # Network isteklerinden resim URL'lerini de çekmeyi dene
            if not image_urls:
                print("      ⚠️ Standart img tag'leri bulunamadı, network kaynaklarına bakılıyor...")
                image_urls = self.driver.execute_script("""
                    // performance.getEntriesByType ile yüklenen kaynakları al
                    let entries = performance.getEntriesByType('resource');
                    let imgs = entries
                        .filter(e => e.initiatorType === 'img' || e.name.match(/\\.(jpg|jpeg|png|webp|gif)/i) || e.name.includes('img_part'))
                        .map(e => e.name)
                        .filter(n => n.startsWith('http'));
                    return [...new Set(imgs)];
                """)

            if not image_urls:
                print("      ⚠️ RESİM BULUNAMADI!")
                return

            print(f"      🖼️ {len(image_urls)} resim bulundu.")

            episode_folder = os.path.join(BASE_PATH, "images", series_slug, f"bolum-{chap_num}")
            saved_paths = []
            for idx, src in enumerate(image_urls):
                fname = f"{series_slug}-bolum-{chap_num}-sahne-{idx+1}.webp"
                saved = process_and_save_image(src, episode_folder, fname)
                if saved:
                    saved_paths.append(saved)

            if not saved_paths:
                print("      ⚠️ Hiçbir resim kaydedilemedi, bölüm atlanıyor.")
                return

            with engine.connect() as conn:
                check = conn.execute(
                    text("SELECT id FROM webtoon_episodes WHERE webtoon_id=:w AND episode_number=:e"),
                    {"w": webtoon_id, "e": chap_num}
                ).fetchone()
                if not check:
                    conn.execute(text("""
                        INSERT INTO webtoon_episodes (webtoon_id, episode_number, title, image_paths, view_count, is_published, created_at)
                        VALUES (:w, :e, :t, :imgs, 0, TRUE, NOW())
                    """), {
                        "w": webtoon_id,
                        "e": chap_num,
                        "t": f"Bölüm {chap_num}",
                        "imgs": json.dumps(saved_paths)
                    })
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
                    conn.execute(text("""
                        INSERT INTO webtoon_episodes (webtoon_id, episode_number, title, image_paths, view_count, is_published, created_at)
                        VALUES (:w, :e, :t, :imgs, 0, TRUE, NOW())
                    """), {
                        "w": webtoon_id,
                        "e": chap_num,
                        "t": f"Bölüm {chap_num}",
                        "imgs": json.dumps(saved_paths)
                    })
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
