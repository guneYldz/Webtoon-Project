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

# ── Çeviri Pipeline ─────────────────────────────────────────────────────────
# Opsiyonel: Modüller bulunamazsa bot çeviri olmadan çalışmaya devam eder
try:
    from ocr_pipeline import run_ocr_pipeline
    from translation import translate_texts
    from typesetter import typeset_page, save_typeset_image, download_fonts
    PIPELINE_AVAILABLE = True
    print("✅ Çeviri pipeline yüklendi (OCR + DeepSeek + Typesetting)")
except ImportError as _pipeline_err:
    PIPELINE_AVAILABLE = False
    print(f"⚠️  Çeviri pipeline yüklenemedi ({_pipeline_err}) — orijinal resimler kaydedilecek")

# ==========================================
# ⚙️ AYARLAR
# ==========================================

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
REPO_ROOT = os.path.dirname(BACKEND_DIR)

load_dotenv(os.path.join(REPO_ROOT, ".env"))
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


BASE_PATH       = os.path.join(BACKEND_DIR, "static")
SERI_DOSYASI    = os.path.join(CURRENT_DIR, "seriler.txt")
SERI_ARASI_BEKLEME = 5
TUR_ARASI_BEKLEME  = 1800

# ──────────────────────────────────────────────────────────────────────────────
# 🌐 UZAK SUNUCU API AYARLARI (Yerel bilgisayardan kaosmanga.net'e yükleme)
# ──────────────────────────────────────────────────────────────────────────────
# Bot yerel PC'de çalışıyorsa sunucuya API üzerinden gönderir.
# Bot sunucuda çalışıyorsa direkt DB'ye yazar (eski davranış).
API_URL      = os.getenv("BOT_API_URL", "https://kaosmanga.net/api")  # Yerel test: http://127.0.0.1:8000
BOT_USERNAME = os.getenv("BOT_USERNAME", "")
BOT_PASSWORD = os.getenv("BOT_PASSWORD", "")

# DB bağlantısı — Sadece sunucuda çalışırken kullanılır
# Yerel moddaysa boş bırakılabilir, API yüklemeyi devralır
_raw_db = os.getenv("BOT_DB_CONNECTION") or os.getenv("DB_CONNECTION", "")
if _raw_db:
    if _platform.system() == "Linux" and "@db:" in _raw_db:
        _raw_db = re.sub(r"@db:(\d+)", "@localhost:5433", _raw_db)
        print("\u26a0\ufe0f  DB hostname 'db' \u2192 'localhost:5433' olarak otomatik d\u00fczelti ldi")
    DB_CONNECTION = _raw_db
    print(f"\U0001f50c DB Ba\u011flant\u0131s\u0131: {DB_CONNECTION.split('@')[-1]}")
    engine = create_engine(DB_CONNECTION)
else:
    DB_CONNECTION = None
    engine = None
    print("\u26a0\ufe0f  DB ba\u011flant\u0131s\u0131 yok \u2014 API mod aktif (kaosmanga.net'e y\u00fckleme yap\u0131lacak)")


# ──────────────────────────────────────────────────────────────────────────────
# 🔑 Sunucuya giriş ve token alma
# ──────────────────────────────────────────────────────────────────────────────
_bot_token: dict = {"token": None, "expires": 0}

def get_bot_token() -> str:
    """
    BOT_USERNAME + BOT_PASSWORD ile sunucuya giriş yap, JWT token al.
    Token 50 dakika cache'lenir (sunucu 3000 dk veriyor ama biz kısa tutalım).
    """
    global _bot_token
    now = time.time()
    if _bot_token["token"] and now < _bot_token["expires"]:
        return _bot_token["token"]

    if not BOT_USERNAME or not BOT_PASSWORD:
        raise RuntimeError(
            "BOT_USERNAME ve BOT_PASSWORD .env i\u00e7inde olmal\u0131!\n"
            "   Bot yerel PC'den çal\u0131\u015f\u0131yorsa bunlar sunucuya giri\u015f i\u00e7in \u015fartt\u0131r."
        )

    try:
        resp = requests.post(
            f"{API_URL}/auth/giris-yap",
            data={"username": BOT_USERNAME, "password": BOT_PASSWORD},
            timeout=15,
        )
        resp.raise_for_status()
        token = resp.json().get("access_token") or resp.json().get("token")
        if not token:
            raise ValueError(f"Token bulunamad\u0131: {resp.text[:200]}")
        _bot_token["token"]   = token
        _bot_token["expires"] = now + 50 * 60  # 50 dakika
        print(f"    \u2705 Sunucu giri\u015fi ba\u015far\u0131l\u0131 ({BOT_USERNAME})")
        return token
    except Exception as e:
        raise RuntimeError(f"\u274c Sunucu giri\u015f hatas\u0131: {e}")


def api_check_episode(webtoon_id: int, chap_num) -> bool:
    """
    Sunucuda bu b\u00f6l\u00fcm zaten var m\u0131 kontrol et.
    True = zaten var (atla). False = yok (i\u015fle).
    """
    try:
        token = get_bot_token()
        resp  = requests.get(
            f"{API_URL}/admin/webtoon/{webtoon_id}/episodes",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code == 200:
            episodes = resp.json()
            existing = {str(int(e["episode_number"])) if float(e["episode_number"]) % 1 == 0
                        else str(e["episode_number"]) for e in episodes}
            chap_str = str(int(float(chap_num))) if float(chap_num) % 1 == 0 else str(chap_num)
            return chap_str in existing
    except Exception as e:
        print(f"    \u26a0\ufe0f api_check_episode hatas\u0131: {e}")
    return False


def api_upload_episode(webtoon_id: int, chap_num, image_paths: list[str]) -> bool:
    """
    Tipset edilmi\u015f resimleri sunucuya y\u00fckle.
    /episodes/ekle endpoint'ini kullan\u0131r (zaten mevcut).
    True = ba\u015far\u0131l\u0131. False = ba\u015far\u0131s\u0131z.
    """
    if not image_paths:
        return False

    try:
        token = get_bot_token()
        files = []
        opened = []
        try:
            for path in image_paths:
                f = open(path, "rb")
                opened.append(f)
                fname = os.path.basename(path)
                files.append(("resimler", (fname, f, "image/webp")))

            data = {
                "webtoon_id":    str(webtoon_id),
                "episode_number": str(chap_num),
                "title":         f"B\u00f6l\u00fcm {chap_num}",
            }

            print(f"      \u2601\ufe0f  Sunucuya y\u00fckleniyor: {len(image_paths)} resim...")
            resp = requests.post(
                f"{API_URL}/episodes/ekle",
                headers={"Authorization": f"Bearer {token}"},
                data=data,
                files=files,
                timeout=120,   # B\u00fcy\u00fck dosya y\u00fcklemesi i\u00e7in uzun timeout
            )

            if resp.status_code in (200, 201):
                print(f"      \u2705 Sunucuya y\u00fcklendi: {resp.json().get('mesaj', 'OK')}")
                return True
            elif resp.status_code == 400 and "mevcut" in resp.text:
                print(f"      \u26a0\ufe0f B\u00f6l\u00fcm zaten mevcut (sunucu r\u00edddet), atlan\u0131yor.")
                return True  # Baz\u0131 durumlarda zaten vard\u0131r, hata de\u011fil
            else:
                print(f"      \u274c Y\u00fckleme hatas\u0131: {resp.status_code} - {resp.text[:300]}")
                return False
        finally:
            for f in opened:
                f.close()

    except Exception as e:
        print(f"      \u274c api_upload_episode hatas\u0131: {e}")
        return False


def api_get_or_create_webtoon(title: str, slug: str, cover_url: str = None) -> int:
    """
    Sunucuda webtoon var m\u0131 kontrol et, yoksa olu\u015ftur. ID d\u00f6nd\u00fcr.
    """
    try:
        token = get_bot_token()
        headers = {"Authorization": f"Bearer {token}"}

        # Slug ile sorgula
        resp = requests.get(f"{API_URL}/webtoons/{slug}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            wid  = data.get("id")
            if wid:
                print(f"    \u2705 Webtoon bulundu: {title} (ID: {wid})")
                return wid

        # Bulunamad\u0131 \u2014 olu\u015ftur
        print(f"    \U0001f195 Yeni webtoon olu\u015fturuluyor: {title}")
        form_data = {
            "title":        title,
            "summary":      f"{title} \u00f6zeti",
            "status":       "ongoing",
            "is_published": "false",   # Admin yay\u0131nlayana kadar gizli
            "series_type":  "WEBTOON",
            "source_url":   "",
        }
        files = []
        cover_file = None
        if cover_url:
            try:
                cover_resp = requests.get(cover_url, timeout=15,
                                          headers={"Referer": "https://asurascans.com/"})
                if cover_resp.status_code == 200:
                    cover_file = ("cover_image", (f"{slug}-cover.webp", cover_resp.content, "image/webp"))
                    files.append(cover_file)
            except Exception:
                pass

        resp = requests.post(
            f"{API_URL}/admin/webtoon/create",
            headers=headers,
            data=form_data,
            files=files if files else None,
            timeout=30,
        )
        if resp.status_code in (200, 201):
            wid = resp.json().get("id")
            print(f"    \u2705 Webtoon olu\u015fturuldu: {title} (ID: {wid})")
            return wid
        else:
            print(f"    \u274c Webtoon olu\u015fturma hatas\u0131: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        print(f"    \u274c api_get_or_create_webtoon hatas\u0131: {e}")
    return None


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
            image.save(full_path, "WEBP", quality=95)
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
        # GPU kapalıyken canvas render olmaz; SwiftShader ile yazılımsal render aktif
        options.add_argument("--use-gl=swiftshader")
        options.add_argument("--enable-webgl")
        options.add_argument("--disable-extensions")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--allow-running-insecure-content")
        # Tainted canvas engelini kaldır (cross-origin canvas screenshot için)
        options.add_argument("--disable-web-security")
        options.add_argument("--allow-file-access-from-files")

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
        if "asurascans.com" in url:
            return "asurascans"
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
            document.querySelectorAll('ul.pagination1 a, .pagination a, .page-link, .pagination-link').forEach(a => {
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
                    'ul.pagination1 a[data-page="{next_page}"], .pagination a[data-page="{next_page}"], .pagination-link[data-page="{next_page}"]'
                );
                if (btn) {{ btn.click(); return true; }}
                // Yöntem 2: Text içeriği rakam olan buton
                let allBtns = document.querySelectorAll('ul.pagination1 a, .pagination a, .page-link, .pagination-link');
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
                var url  = arguments[0];
                var done = arguments[arguments.length - 1];
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

        Yöntem sırası (her sayfa için):
        A) Selenium element.screenshot_as_png  → tainted canvas bypass
        B) canvas.toDataURL()                  → --disable-web-security ile çalışır
        C) <img> src browser fetch             → canvas olmayan sayfalar için
        """
        import base64

        def _scroll_and_wait(driver, page_index, wait_sec=2.5):
            driver.execute_script(f"""
                var p = document.querySelectorAll('.chapter-page')[{page_index}];
                if (p) p.scrollIntoView({{behavior: 'instant', block: 'center'}});
            """)
            time.sleep(wait_sec)

        def _canvas_to_b64(driver, page_index, retries=4):
            """Canvas.toDataURL() — tüm piksel verisi, viewport bağımsız.
            --disable-web-security ile cross-origin taint engeli kalkar.
            """
            for _ in range(retries):
                b64 = driver.execute_script(f"""
                    var page = document.querySelectorAll('.chapter-page')[{page_index}];
                    if (!page) return null;
                    var c = page.querySelector('canvas');
                    if (!c || c.width === 0 || c.height === 0) return null;
                    try {{
                        var d = c.toDataURL('image/png');
                        if (!d || d === 'data:,' || d.length < 100) return null;
                        return d.split(',')[1] || null;
                    }} catch(e) {{ return null; }}
                """)
                if b64:
                    try:
                        raw = base64.b64decode(b64)
                        img = Image.open(BytesIO(raw))
                        w, h = img.size
                        if w < 100 or h < 100:
                            time.sleep(1.5); continue
                        pixels = list(img.convert('RGB').getdata())
                        sample = pixels[::max(1, len(pixels) // 400)]
                        if len(sample) > 10 and all(p == sample[0] for p in sample):
                            time.sleep(1.5); continue
                        return b64  # ✅ Geçerli, tam boyutlu canvas
                    except Exception:
                        return b64
                time.sleep(1.5)
            return None

        def _element_screenshot_full(driver, page_index):
            """Selenium element screenshot — tainted canvas fallback.
            Pencereyi canvas yüksekliğine ayarlayarak crop'u önler.
            """
            try:
                # Canvas boyutlarını JS'den oku
                dims = driver.execute_script(f"""
                    var page = document.querySelectorAll('.chapter-page')[{page_index}];
                    if (!page) return null;
                    var c = page.querySelector('canvas');
                    if (c && c.width > 0 && c.height > 0)
                        return {{w: c.width, h: c.height, el: 'canvas'}};
                    var r = page.getBoundingClientRect();
                    return {{w: Math.round(r.width), h: Math.round(r.height), el: 'page'}};
                """)
                if not dims or dims.get('w', 0) < 100 or dims.get('h', 0) < 100:
                    return None

                canvas_h = int(dims['h'])
                canvas_w = int(dims['w'])

                # Pencereyi canvas yüksekliğine ayarla (+ margin)
                driver.set_window_size(max(1920, canvas_w + 100), canvas_h + 200)
                time.sleep(0.5)

                # Canvas'a scroll et ve tam screenshot al
                driver.execute_script(f"""
                    var page = document.querySelectorAll('.chapter-page')[{page_index}];
                    if (page) page.scrollIntoView({{behavior: 'instant', block: 'start'}});
                """)
                time.sleep(0.5)

                pages = driver.find_elements(By.CSS_SELECTOR, '.chapter-page')
                if page_index >= len(pages):
                    return None
                page_el = pages[page_index]

                canvas_els = page_el.find_elements(By.TAG_NAME, 'canvas')
                target_el = canvas_els[0] if canvas_els else page_el
                png = target_el.screenshot_as_png

                # Pencereyi geri döndür
                driver.set_window_size(1920, 1080)

                if not png or len(png) < 500:
                    return None
                img = Image.open(BytesIO(png))
                w, h = img.size
                if w < 100 or h < 100:
                    return None
                pixels = list(img.convert('RGB').getdata())
                sample = pixels[::max(1, len(pixels) // 400)]
                if len(sample) > 10 and all(p == sample[0] for p in sample):
                    return None
                return png
            except Exception as e:
                print(f"        ⚠️ element screenshot hatası: {e}")
                try:
                    driver.set_window_size(1920, 1080)
                except Exception:
                    pass
                return None

        def _get_img_url(driver, page_index):
            return driver.execute_script(f"""
                var p = document.querySelectorAll('.chapter-page')[{page_index}];
                if (!p) return null;
                var img = p.querySelector('img');
                if (!img) return null;
                return img.getAttribute('data-src') || img.getAttribute('data-original')
                       || img.getAttribute('src') || null;
            """)

        def _fetch_bytes(driver, img_url):
            try:
                result = driver.execute_async_script("""
                    var url = arguments[0], done = arguments[arguments.length-1];
                    fetch(url, {credentials:'include'})
                        .then(r => r.arrayBuffer())
                        .then(buf => {
                            var b = new Uint8Array(buf), s = '';
                            for (var i=0;i<b.byteLength;i++) s += String.fromCharCode(b[i]);
                            done({ok:true, data:btoa(s)});
                        }).catch(e => done({ok:false, error:e.toString()}));
                """, img_url)
                if result and result.get('ok') and result.get('data'):
                    return base64.b64decode(result['data'])
            except Exception as e:
                print(f"        ⚠️ fetch hatası: {e}")
            return None

        def _save_image(img_bytes, episode_folder, fname):
            image = Image.open(BytesIO(img_bytes))
            image.verify()
            image = Image.open(BytesIO(img_bytes))
            w, h = image.size
            if w < 100 or h < 100:
                return None, w, h
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            os.makedirs(episode_folder, exist_ok=True)
            full_path = os.path.join(episode_folder, fname)
            image.save(full_path, "WEBP", quality=95)
            return full_path, w, h

        try:
            # ── 1. Bölümü yükle ──────────────────────────────────────────────────
            self.driver.get(url)
            time.sleep(8)

            episode_folder = os.path.join(BASE_PATH, "images", series_slug, f"bolum-{chap_num}")
            saved_paths = []

            # ── 2. Scroll ile lazy-load + render tetikle ──────────────────────────
            print(f"      📄 Lazy-load scroll başlıyor...")
            for step in range(1, 12):
                self.driver.execute_script(
                    f"window.scrollTo(0, document.body.scrollHeight * {step}/11);"
                )
                time.sleep(0.7)
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(3)

            # ── 3. Sayfa sayısı ───────────────────────────────────────────────────
            num_pages = self.driver.execute_script(
                "return document.querySelectorAll('.chapter-page').length;"
            )
            if num_pages == 0:
                print("      ⚠️ Hiçbir .chapter-page bulunamadı.")
                return
            print(f"      📄 Toplam {num_pages} sayfa.")

            # ── 4. Her sayfayı işle ───────────────────────────────────────────────
            for i in range(num_pages):
                fname = f"{series_slug}-bolum-{chap_num}-sayfa-{i+1}.webp"
                img_bytes = None
                method = ""

                # Sayfayı görünüme getir, render bekle
                _scroll_and_wait(self.driver, i, wait_sec=2.5)

                # --- Yöntem A: canvas.toDataURL() ---
                # viewport bağımsız tam canvas verisi verir, banner vs. olmaz
                b64 = _canvas_to_b64(self.driver, i)
                if b64:
                    try:
                        img_bytes = base64.b64decode(b64)
                        method = "toDataURL"
                    except Exception:
                        pass

                # --- Yöntem B: Selenium element screenshot (pencere yeniden boyutlandırılır) ---
                if not img_bytes:
                    png = _element_screenshot_full(self.driver, i)
                    if png:
                        img_bytes = png
                        method = "element-screenshot"

                # --- Yöntem C: <img> src fetch ---
                if not img_bytes:
                    img_url = _get_img_url(self.driver, i)
                    if img_url and img_url.startswith("http"):
                        print(f"      🌐 img fetch (sayfa {i+1}): {img_url[:70]}")
                        img_bytes = _fetch_bytes(self.driver, img_url)
                        if not img_bytes:
                            try:
                                cookies = self._get_browser_cookies()
                                resp = requests.get(
                                    img_url,
                                    headers={'User-Agent': 'Mozilla/5.0', 'Referer': url},
                                    cookies=cookies, stream=True, timeout=20
                                )
                                if resp.status_code == 200 and len(resp.content) > 1000:
                                    img_bytes = resp.content
                            except Exception as e:
                                print(f"      ⚠️ requests hatası: {e}")
                        if img_bytes:
                            method = "img-fetch"

                # --- Kaydet ---
                if img_bytes:
                    try:
                        full_path, w, h = _save_image(img_bytes, episode_folder, fname)
                        if full_path is None:
                            print(f"      ⚠️ Sayfa {i+1} çok küçük, atlandı.")
                            continue
                        saved = os.path.relpath(full_path, BACKEND_DIR).replace("\\", "/")
                        print(f"      ✅ [{method}] Kaydedildi ({w}x{h}): {fname}")
                        saved_paths.append(saved)
                    except Exception as e:
                        print(f"      ⚠️ Görsel işleme hatası (sayfa {i+1}): {e}")
                else:
                    print(f"      ❌ Sayfa {i+1}: Tüm yöntemler başarısız, atlandı.")

            # ── 5. Kaydet (API → Sunucu veya DB → Direkt) ───────────────────
            if not saved_paths:
                print("      ⚠️ Hiçbir sayfa kaydedilemedi, bölüm atlanıyor.")
                return

            print(f"      🖼️ {len(saved_paths)} sayfa tamamlandı.")

            if BOT_USERNAME and BOT_PASSWORD:
                # 🌐 API Modu — Yerel PC'den sunucuya yükle
                abs_paths = [os.path.join(BACKEND_DIR, p) for p in saved_paths]
                api_upload_episode(webtoon_id, chap_num, abs_paths)
            elif engine:
                # 🗄️ Direkt DB Modu — Bot sunucuda çalışıyor
                with engine.connect() as conn:
                    check = conn.execute(
                        text("SELECT id FROM webtoon_episodes WHERE webtoon_id=:w AND episode_number=:e"),
                        {"w": webtoon_id, "e": chap_num}
                    ).fetchone()
                    if not check:
                        result = conn.execute(text("""
                            INSERT INTO webtoon_episodes
                                (webtoon_id, episode_number, title, view_count, is_published, created_at)
                            VALUES (:w, :e, :t, 0, TRUE, NOW()) RETURNING id
                        """), {"w": webtoon_id, "e": chap_num, "t": f"Bölüm {chap_num}"})
                        episode_id = result.fetchone()[0]
                        for order, path in enumerate(saved_paths, start=1):
                            conn.execute(text("""
                                INSERT INTO episode_images (episode_id, image_url, page_order)
                                VALUES (:eid, :url, :ord)
                            """), {"eid": episode_id, "url": path, "ord": order})
                        conn.commit()
                        print(f"      ✅ DB'ye kaydedildi: {len(saved_paths)} sayfa")
            else:
                print("      ⚠️ Ne API bilgisi ne de DB bağlantısı var — kayıt yapılamadı!")

        except Exception as e:
            print(f"      ❌ İndirme hatası: {e}")



    # -------------------------------------------------------
    # Genel (generic) seri kontrolü — eski mantık
    # -------------------------------------------------------
    def check_single_series(self, target_url):
        site = self._detect_site(target_url)
        if site == "manga-tr":
            return self.check_manga_tr(target_url)
        if site == "asurascans":
            return self.check_asurascans(target_url)

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

    # -------------------------------------------------------
    # asurascans.com için özel seri kontrolü
    # -------------------------------------------------------
    def check_asurascans(self, target_url):
        """asurascans.com seri sayfasını kontrol et ve yeni bölümleri indir."""
        print(f"\n🕵️ [{time.strftime('%H:%M:%S')}] [asurascans] Kontrol: {target_url}")
        try:
            self.driver.get(target_url)
            time.sleep(6)

            # ── 1. Başlık ──────────────────────────────────────────────────────
            title = None
            for selector in ["h1", ".font-bold.text-xl", ".font-bold", "h2"]:
                try:
                    el = self.driver.find_element(By.CSS_SELECTOR, selector)
                    t = el.text.strip()
                    if t:
                        title = t
                        break
                except Exception:
                    continue
            if not title:
                print("    ⚠️ Başlık bulunamadı, seri atlandı.")
                return
            print(f"    📖 Başlık: {title}")

            slug = slugify(title)

            # ── 2. Kapak görseli ───────────────────────────────────────────────
            cover_src = None
            for sel in ["div.aspect-[3/4] img", ".summary_image img", "img[src*='cover']",
                        "img[src*='thumbnail']", "img[alt*='cover']", "img[alt]"]:
                try:
                    el = self.driver.find_element(By.CSS_SELECTOR, sel)
                    src = el.get_attribute("src") or el.get_attribute("data-src")
                    if src and src.startswith("http"):
                        cover_src = src
                        break
                except Exception:
                    continue
            # JS ile dene
            if not cover_src:
                try:
                    cover_src = self.driver.execute_script(
                        "var img = document.querySelector('img[src]');"
                        "return img ? img.src : null;"
                    )
                except Exception:
                    pass

            webtoon_id = self.sync_webtoon_info(title, slug, cover_src)

            # ── 3. Bölüm listesi — asurascans tüm bölümleri tek scrollable div'de gösterir ──
            site_chapters = self._get_asurascans_chapters(target_url)

            existing_chapters = self.get_db_chapters(webtoon_id)
            new_chapters = [ch for ch in site_chapters if ch["num"] not in existing_chapters]

            if not new_chapters:
                print(f"    ✅ Durum: GÜNCEL. ({len(site_chapters)} bölüm var)")
            else:
                print(f"    🚀 {len(new_chapters)} YENİ BÖLÜM YAKALANDI!")
                for chap in reversed(new_chapters):
                    print(f"\n    ⬇️ İndiriliyor: Bölüm {chap['num']}")
                    self.download_chapter_asurascans(chap["url"], webtoon_id, chap["num"], slug)

        except Exception as e:
            print(f"❌ [asurascans] Seri işlenirken hata: {e}")

    def _get_asurascans_chapters(self, series_url):
        """asurascans.com tüm bölümleri scrollable div'den topla."""
        # Bölüm linkleri a[href*="/chapter/"] ile alınır
        # Sitenin scrollable div'i lazy render yapmaz, tüm linkler DOM'da mevcut
        chapters_raw = self.driver.execute_script("""
            var seen = new Set();
            var results = [];
            document.querySelectorAll('a[href*="/chapter/"]').forEach(function(a) {
                var href = a.href;
                if (seen.has(href)) return;
                seen.add(href);
                // URL'den bölüm numarasını çıkar: /chapter/123 veya /chapter/123.5
                var match = href.match(/\/chapter\/(\d+(?:\.\d+)?)/i);
                if (match) {
                    results.push({ num: match[1], url: href });
                }
            });
            return results;
        """)

        if not chapters_raw:
            print("    ⚠️ Bölüm listesi bulunamadı! Scrollable div scroll deneniyor...")
            # Scrollable div varsa kaydır
            try:
                self.driver.execute_script("""
                    var el = document.querySelector('div[class*=\"overflow-y-auto\"]');
                    if (el) { el.scrollTop = el.scrollHeight; }
                """)
                time.sleep(2)
                chapters_raw = self.driver.execute_script("""
                    var seen = new Set();
                    var results = [];
                    document.querySelectorAll('a[href*="/chapter/"]').forEach(function(a) {
                        var href = a.href;
                        if (seen.has(href)) return;
                        seen.add(href);
                        var match = href.match(/\/chapter\/(\d+(?:\.\d+)?)/i);
                        if (match) results.push({ num: match[1], url: href });
                    });
                    return results;
                """)
            except Exception:
                pass

        if not chapters_raw:
            print("    ⚠️ Bölüm listesi tamamen boş!")
            return []

        # Sayısal sıraya koy
        chapters_raw.sort(key=lambda x: float(x['num']))
        print(f"    📚 Toplam {len(chapters_raw)} bölüm bulundu.")
        return chapters_raw

    # -------------------------------------------------------
    # Asurascans: görsel kalite filtresi (meme/fotoğraf tespiti)
    # -------------------------------------------------------
    @staticmethod
    def _is_manga_page(img_bytes: bytes) -> tuple[bool, str]:
        """Verilen ham görsel baytlarının manga sayfası olup olmadığını tespit et.

        Manga sayfaları:
        - Genellikle gri tonlamalı (düşük ortalama renk doygunluğu)
        - Yüksek kontrast (pikseller siyah veya beyaza yakın)
        - En-boy oranı genellikle dikey (yükseklik > genişlik) veya kare

        Fotoğraf/meme:
        - Yüksek doygunluk (renkli piksel bolluğu)
        - Düşük kontrast / çok orta ton
        - Bazen yatay (meme kolajları)

        Döndürür: (manga_mi: bool, sebep: str)
        """
        try:
            img = Image.open(BytesIO(img_bytes)).convert("RGB")
            w, h = img.size

            # ── Boyut kontrolü: çok küçük görseller (reklam/ikon) ──────────────
            if w < 200 or h < 200:
                return False, f"çok küçük ({w}x{h})"

            # ── En-boy oranı: çok geniş yatay görseller genellikle reklam/banner
            aspect = w / h
            if aspect > 3.0:
                return False, f"yatay banner oranı ({aspect:.1f})"

            # ── Piksel örnekleme ──────────────────────────────────────────────
            # Performans için 200x200'e küçült
            thumb = img.resize((200, 200), Image.LANCZOS)
            pixels = list(thumb.getdata())  # [(R,G,B), ...]

            total = len(pixels)

            # Renk doygunluğu: her piksel için max(R,G,B) - min(R,G,B)
            saturations = [max(p) - min(p) for p in pixels]
            avg_sat = sum(saturations) / total

            # Ortalama parlaklık
            brightnesses = [(p[0] + p[1] + p[2]) / 3 for p in pixels]
            avg_bright = sum(brightnesses) / total

            # Kontrast: parlaklık standart sapması
            variance = sum((b - avg_bright) ** 2 for b in brightnesses) / total
            std_dev = variance ** 0.5

            # Siyah-beyaz piksel oranı (doygunluk < 20 olanlar)
            bw_count = sum(1 for s in saturations if s < 20)
            bw_ratio = bw_count / total

            # ── Karar mantığı ─────────────────────────────────────────────────
            # Fotoğraf/meme kriterleri (hepsi bir arada olursa FİLTRELENECEK):
            #   - Yüksek ortalama doygunluk (renkli fotoğraf) VE
            #   - Düşük kontrast (manga'daki siyah-beyaz keskinliği yok)
            # Renkli manga sayfalarını (webtoon) yanlışlıkla silmemek için
            # eşikler yüksek tutuldu — sadece gerçek fotoğrafları yakalar.
            is_photo = avg_sat > 50 and std_dev < 45

            # İkinci kriter: siyah-beyaz piksel oranı çok düşük → fotoğraf
            is_colorful = bw_ratio < 0.20 and avg_sat > 40

            if is_photo and is_colorful:
                return False, (
                    f"fotoğraf/meme (sat={avg_sat:.0f}, kontrast={std_dev:.0f}, "
                    f"b&w={bw_ratio:.0%})"
                )

            return True, (
                f"manga sayfası (sat={avg_sat:.0f}, kontrast={std_dev:.0f}, "
                f"b&w={bw_ratio:.0%})"
            )
        except Exception as e:
            # Analiz başarısız → iyimser ol, kabul et
            return True, f"analiz hatası ({e}), kabul edildi"

    def download_chapter_asurascans(self, url, webtoon_id, chap_num, series_slug):
        """asurascans.com bölümünü indir, OCR + Çeviri + Typesetting uygula.

        İşlem sırası:
          1. Sayfayı aç, lazy-load için scroll et
          2. Manga reader container'ından <img> URL'lerini topla
          3. Resimleri indir (browser fetch → requests fallback)
          4. Piksel analizi: meme/fotoğraf olan sayfaları (özellikle sondakileri) filtrele
          5. [PIPELINE] Her resim için: OCR → Çeviri (DeepSeek) → Typesetting (Pillow)
          6. Tipset edilmiş WEBP'leri kaydet, DB'ye yaz

        PIPELINE_AVAILABLE=False ise 5. adım atlanır — orijinal resimler kaydedilir.
        """
        BLACKLIST_ASURA = [
            'logo', 'icon', 'favicon', 'banner', 'avatar', 'ads',
            'pixel', 'facebook', 'twitter', 'instagram', 'google',
            '_next', 'data:image',
        ]

        try:
            self.driver.get(url)
            time.sleep(7)

            episode_folder = os.path.join(BASE_PATH, "images", series_slug, f"bolum-{chap_num}")
            saved_paths = []

            # ── Lazy-load için sayfayı aşağı-yukarı scroll et ──────────────────
            print(f"      📄 Lazy-load scroll başlıyor...")
            for step in range(1, 15):
                self.driver.execute_script(
                    f"window.scrollTo(0, document.body.scrollHeight * {step}/14);"
                )
                time.sleep(0.6)
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(2)

            # ── Asura Next.js DOM'una Özel Resim Toplama ──────────────────────
            # Eski WordPress selector'ları (#readerarea, .reading-content) artık yok.
            # Asura, Next.js + Tailwind CSS kullanıyor.
            # Strateji: TÜM img'leri al, sonra yasak ata (ancestor) elemeleri uygula.
            image_urls = self.driver.execute_script("""
                // ── URL Kara Listesi ──────────────────────────────────────────
                var BL = ['logo','icon','favicon','banner','avatar','ads','pixel',
                          'facebook','twitter','instagram','google','_next/',
                          'discord','patreon','subscribe','gravatar','disqus',
                          'tenor.com','giphy.com','imgur.com','tiktok',
                          'profile-pic','user-avatar','user_avatar',
                          '/emoji/','badge','subscription'];
                function isOkUrl(src) {
                    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false;
                    var s = src.toLowerCase();
                    return !BL.some(function(b){ return s.indexOf(b) !== -1; });
                }

                // ── Yasak Ata (Ancestor) Kontrolü ────────────────────────────
                // Bir img'in herhangi bir atası aşağıdakilerden biriyse → DIŞLA:
                //   - <a href="/user/...">        → kullanıcı profil resmi
                //   - <button>, <nav>, <footer>   → UI öğesi/navigasyon
                //   - data-comment, class*=comment → yorum alanı içi
                //   - class*="reaction"            → tepki butonları
                function hasBlockedAncestor(el) {
                    var node = el.parentElement;
                    var maxDepth = 10;
                    while (node && maxDepth-- > 0) {
                        var tag = node.tagName;
                        // UI konteynerları
                        if (tag === 'BUTTON' || tag === 'NAV' || tag === 'FOOTER') return true;
                        // Kullanıcı profil linkleri
                        if (tag === 'A') {
                            var href = (node.getAttribute('href') || '').toLowerCase();
                            if (href.indexOf('/user/') !== -1 ||
                                href.indexOf('/profile') !== -1 ||
                                href.indexOf('/member') !== -1) return true;
                        }
                        // Yorum/tepki alanları
                        var cls = (node.className || '').toString().toLowerCase();
                        var nid = (node.id || '').toLowerCase();
                        if (cls.indexOf('comment') !== -1 || nid.indexOf('comment') !== -1) return true;
                        if (cls.indexOf('reaction') !== -1 || cls.indexOf('review') !== -1) return true;
                        if (cls.indexOf('respond') !== -1 || nid.indexOf('respond') !== -1) return true;
                        if (cls.indexOf('community') !== -1) return true;
                        node = node.parentElement;
                    }
                    return false;
                }

                // ── Tüm img'leri tara, filtrele ──────────────────────────────
                var allImgs = document.querySelectorAll('img');
                var seen = {}; var result = [];
                allImgs.forEach(function(img) {
                    // Ancestor kontrolü
                    if (hasBlockedAncestor(img)) return;

                    var src = img.getAttribute('data-src')
                             || img.getAttribute('data-original')
                             || img.src || '';
                    src = src.trim();
                    if (!isOkUrl(src)) return;
                    if (seen[src]) return;

                    var w = img.naturalWidth || parseInt(img.getAttribute('width') || '0');
                    var h = img.naturalHeight || parseInt(img.getAttribute('height') || '0');

                    // Boyutu bilinen görseller için: manga sayfaları genellikle ≥600px genişlik
                    if (w > 0 && h > 0) {
                        if (w < 400) return;  // Çok küçük → ikon/avatar/logo
                        if (w > 0 && h > 0 && w / h > 4.0) return;  // Banner
                    }

                    seen[src] = true;
                    result.push({ url: src, w: w, h: h });
                });
                return result;
            """)

            if not image_urls:
                print("      ⚠️ Hiçbir resim bulunamadı!")
                return

            # ── Python: Dominant CDN + Son URL Blacklist ──────────────────────
            from urllib.parse import urlparse
            from collections import Counter

            # URL'leri çıkar ve son blacklist uygula
            candidates = []
            for item in image_urls:
                src = item['url']
                if not any(b in src.lower() for b in BLACKLIST_ASURA):
                    candidates.append(src)

            if not candidates:
                print("      ⚠️ Filtrelerden geçen resim kalmadı!")
                return

            # Dominant CDN domain tespiti
            try:
                hostnames = [urlparse(s).hostname or '' for s in candidates]
                counts = Counter(h for h in hostnames if h)
                if counts:
                    dominant_host, dominant_count = counts.most_common(1)[0]
                    total = len(candidates)
                    if dominant_count / total >= 0.5:
                        print(f"      🌐 Dominant CDN: {dominant_host} ({dominant_count}/{total})")
                        filtered = [s for s in candidates
                                    if (urlparse(s).hostname or '') == dominant_host]
                        rejected = total - len(filtered)
                        if rejected:
                            print(f"      🔕 CDN filtresi: {rejected} yabancı-domain resim atıldı")
                    else:
                        filtered = candidates
                else:
                    filtered = candidates
            except Exception:
                filtered = candidates

            print(f"      🖼️ {len(filtered)} bölüm resmi bulundu, indiriliyor...")

            cookies = self._get_browser_cookies()

            valid_count = 0
            raw_downloads = []  # (orig_idx, url, bytes, is_manga)
            for idx, img_url in enumerate(filtered):
                fname = f"{series_slug}-bolum-{chap_num}-sayfa-{idx+1}.webp"

                # Önce browser fetch dene (oturum cookie'leri ile)
                img_bytes = None
                try:
                    result = self.driver.execute_async_script("""
                        var url = arguments[0], done = arguments[arguments.length-1];
                        fetch(url, {credentials: 'include'})
                            .then(function(r) { return r.arrayBuffer(); })
                            .then(function(buf) {
                                var b = new Uint8Array(buf), s = '';
                                for (var i=0; i<b.byteLength; i++) s += String.fromCharCode(b[i]);
                                done({ok: true, data: btoa(s)});
                            }).catch(function(e) { done({ok: false, error: e.toString()}); });
                    """, img_url)
                    if result and result.get('ok') and result.get('data'):
                        import base64
                        img_bytes = base64.b64decode(result['data'])
                except Exception as e:
                    print(f"        ⚠️ fetch hatası ({idx+1}): {e}")

                # Fallback: requests ile dene
                if not img_bytes:
                    try:
                        resp = requests.get(
                            img_url,
                            headers={
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Referer': 'https://asurascans.com/',
                                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                            },
                            cookies=cookies,
                            stream=True, timeout=20
                        )
                        if resp.status_code == 200 and len(resp.content) > 1000:
                            img_bytes = resp.content
                    except Exception as e:
                        print(f"        ⚠️ requests hatası ({idx+1}): {e}")

                if not img_bytes or len(img_bytes) < 1000:
                    print(f"      ⚠️ Sayfa {idx+1} atlandı (veri yok/çok küçük).")
                    continue

                # ── Piksel analizi: manga mı, fotoğraf/meme mi? ──────────────
                is_manga, reason = self._is_manga_page(img_bytes)
                if not is_manga:
                    print(f"      🚫 Sayfa {idx+1} FİLTRELENDİ [{reason}]: {img_url[:60]}")
                    raw_downloads.append((idx, img_url, img_bytes, False))  # manga değil
                    continue
                # ─────────────────────────────────────────────────────────────

                print(f"      ✅ Sayfa {idx+1} kabul edildi [{reason}]")
                raw_downloads.append((idx, img_url, img_bytes, True))  # manga

            # ── Sondaki ardışık non-manga sayfaları kes ───────────────────────
            # Ortada 1-2 renkli sayfa olabilir (sinemik panel, sinematik kare)
            # ama bölüm SONUNA eklenmiş meme/reklam bloklarını keseceğiz.
            # Arkadan tara: kaç tane art arda non-manga var?
            trim_index = len(raw_downloads)
            for _i in range(len(raw_downloads) - 1, -1, -1):
                if not raw_downloads[_i][3]:  # non-manga
                    trim_index = _i
                else:
                    break  # İlk gerçek manga sayfasına ulaştık, dur

            trimmed_count = len(raw_downloads) - trim_index
            if trimmed_count > 0:
                print(f"      ✂️  Bölüm sonundaki {trimmed_count} sahte sayfa kesildi.")

            manga_downloads = raw_downloads[:trim_index]

            if not manga_downloads:
                print("      ⚠️ Hiçbir manga sayfası kalmadı, bölüm atlanıyor.")
                return

            # ── Geçerli sayfaları kaydet ──────────────────────────────────────
            for seq, (orig_idx, img_url, img_bytes, _) in enumerate(manga_downloads, start=1):
                fname = f"{series_slug}-bolum-{chap_num}-sayfa-{seq}.webp"
                try:
                    image = Image.open(BytesIO(img_bytes))
                    image.verify()
                    image = Image.open(BytesIO(img_bytes))
                    w, h = image.size
                    if w < 100 or h < 100:
                        continue
                    if image.mode in ("RGBA", "P"):
                        image = image.convert("RGB")
                    os.makedirs(episode_folder, exist_ok=True)
                    full_path = os.path.join(episode_folder, fname)

                    # ── Pipeline: OCR → Çeviri → Typesetting ────────────────
                    if PIPELINE_AVAILABLE:
                        try:
                            # 1. OCR: Sayfadaki metin bölgelerini bul
                            regions = run_ocr_pipeline(image)

                            if regions:
                                eng_texts = [r["text"] for r in regions]
                                print(f"        📖 OCR: {len(regions)} metin bölgesi bulundu")

                                # 2. DeepSeek ile Türkçe'ye çevir
                                tr_texts = translate_texts(eng_texts)

                                # 3. Typesetting: Balonları temizle + Türkçe yaz
                                result_img = typeset_page(image, regions, tr_texts)
                                result_img.save(full_path, "WEBP", quality=95)
                                print(f"      ✅ [Çeviri+Typeset] Kaydedildi ({w}x{h}): {fname}")
                            else:
                                # Metin bulunamadı — orijinali kaydet
                                image.save(full_path, "WEBP", quality=95)
                                print(f"      ✅ [OCR boş, orijinal] Kaydedildi ({w}x{h}): {fname}")
                        except Exception as pipeline_err:
                            # Pipeline hatası — orijinali kaydet, bölümü kaybetme
                            print(f"      ⚠️ Pipeline hatası (sayfa {seq}), orijinal kaydediliyor: {pipeline_err}")
                            image.save(full_path, "WEBP", quality=95)
                    else:
                        # Pipeline yüklü değil — orijinali kaydet
                        image.save(full_path, "WEBP", quality=95)
                        print(f"      ✅ Kaydedildi ({w}x{h}): {fname}")
                    # ────────────────────────────────────────────────────────

                    saved = os.path.relpath(full_path, BACKEND_DIR).replace("\\", "/")
                    saved_paths.append(saved)
                    valid_count += 1
                except Exception as e:
                    print(f"      ⚠️ Görsel işleme hatası (sayfa {seq}): {e}")

            # ── DB'ye kaydet ──────────────────────────────────────────────────
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
                        INSERT INTO webtoon_episodes
                            (webtoon_id, episode_number, title, view_count, is_published, created_at)
                        VALUES (:w, :e, :t, 0, TRUE, NOW()) RETURNING id
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
            print(f"      ❌ [asurascans] İndirme hatası: {e}")


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
                VALUES (:t, :s, :sum, :c, 'ongoing', 'WEBTOON', 0, FALSE, TRUE, NOW())
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
