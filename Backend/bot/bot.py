import sys
import os
import time
import re
import requests
import undetected_chromedriver as uc
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, text
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from dotenv import load_dotenv
from google import genai
from slugify import slugify

# Force UTF-8 for console output
if sys.stdout.encoding != 'utf-8':
    try:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except: pass

# ==========================================
# ⚙️ AYARLAR
# ==========================================

# Botun çalıştığı klasör
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# Bir üst klasör (Backend)
BACKEND_DIR = os.path.dirname(CURRENT_DIR)

# .env dosyasını yükle
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
BEKLEME_SURESI = 10

# 🔑 API KEY ROTATION: 429 alınca otomatik sonraki key'e geç
GOOGLE_API_KEYS = [
    k for k in [
        os.getenv("GOOGLE_API_KEY"),
        os.getenv("GOOGLE_API_KEY_2"),
        os.getenv("GOOGLE_API_KEY_3"),
        os.getenv("GOOGLE_API_KEY_4"),
        os.getenv("GOOGLE_API_KEY_5"),
        os.getenv("GOOGLE_API_KEY_6"),
        os.getenv("GOOGLE_API_KEY_7")
    ] if k  # None olanları filtrele
]

if not GOOGLE_API_KEYS:
    print("❌ HATA: Hiçbir API Anahtarı bulunamadı! .env dosyasını kontrol et.")
    exit()

print(f"🔑 {len(GOOGLE_API_KEYS)} API key yüklendi.")

# Aktif key index'i (global, rotation için)
_current_key_index = 0

def get_gemini_client():
    """Aktif key ile Gemini client döndür"""
    return genai.Client(api_key=GOOGLE_API_KEYS[_current_key_index])

def rotate_key():
    """Bir sonraki key'e geç, döngüsel"""
    global _current_key_index
    _current_key_index = (_current_key_index + 1) % len(GOOGLE_API_KEYS)
    print(f"🔄 API Key rotasyonu: Key #{_current_key_index + 1} aktif")

# 🔥 KRİTİK AYAR: Docker PostgreSQL Bağlantısı (DIŞARIDAN ERİŞİM)
DB_CONNECTION = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"

client = get_gemini_client()
# Gemini 1.5 Flash (Zeki ve Hızlı)

# PostgreSQL için motor oluşturuluyor
engine = create_engine(DB_CONNECTION)

# ==========================================
# 📚 ROMANLARA ÖZEL SÖZLÜKLER (CONFIG)
# ==========================================
NOVEL_CONFIGS = {
    "Shadow Slave": """
        1. "Nightmare Spell" -> "Kabus Büyüsü"
        2. "First Trial" -> "İlk Sınav"
        3. "Aspirant" -> "Aday"
        4. "Awakened" -> "Uyanmış"
        5. "Sleeper" -> "Uyuyan"
        6. "Sunny" -> "Sunny", "Nephis" -> "Nephis"
        7. "Legacy" -> "Miras"
        8. "Aspect" -> "Veçhe"
        9. "Memory" -> "Anı"
        10. "Echo" -> "Yankı"
    """,
    

    "Ghost Story": """
        1. "Ghost Story" -> "Hayalet Hikayesi"
        2. "Entity" -> "Varlık" (Eğer korkutucu bir tondaysa "Ucube" de kullanılabilir)
        3. "Cursed" -> "Lanetli"
        4. "Talisman" -> "Tılsım"
        5. "Exorcist" -> "Ruh Kovucu"
        6. "Evil Spirit" -> "Kötücül Ruh"
        7. "Eerie" -> "Ürkütücü / Tekin olmayan"
        8. "Haunted" -> "Perili / Musallatlı"
        9. "System" -> "Sistem"
        10. "Still gotta work" -> "Hâlâ çalışmak lazım" (Serinin ironik tonunu koru)
        11. Karakter adlarını (varsa özel isimler) ASLA çevirme.
        12. Ton: Gerilimli ama ana karakterin işine bağlılığını hissettiren, hafif absürt ve edebi bir dil.
    """,
    "default": """
        1. Özel isimleri (Karakter adları, şehir adları) ASLA çevirme.
        2. Büyü isimlerini mümkünse Türkçe karşılığıyla, parantez içinde İngilizcesi olacak şekilde çevir.
        3. Ton: Edebi, akıcı ve romanın türüne uygun.
    """,

    
}

# ==========================================
# � HAYALET BÖLÜM (Ghost Chapter) Koruması
# ==========================================
# Freewebnovel gibi siteler olmayan bölümler için 404 vermek yerine
# sahte bir sayfa gösterebilir. Bu kelimeler içerikteyse bölüm sahtedir.
GHOST_CHAPTER_KEYWORDS = [
    "coming soon", "chapter not found", "this chapter is locked",
    "chapter is not available", "no chapter found", "page not found",
    "does not exist", "chapter coming soon", "will be released",
    "subscribe to read", "premium chapter", "locked chapter",
]
MIN_CHAPTER_LENGTH = 1500  # Gerçek bir roman bölümü en az ~300 kelime = ~1500 karakter


# ==========================================
# �🔍 EN SON BÖLÜMÜ ÖĞREN (DOĞRUDAN DB)
# ==========================================
def get_last_chapter_number(novel_id):
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT chapter_number FROM novel_chapters WHERE novel_id = :nid ORDER BY chapter_number DESC LIMIT 1"),
                {"nid": novel_id}
            ).fetchone()
            if result:
                return result[0]
        return 0
    except Exception as e:
        print(f"❌ Son bölüm çekilirken hata: {e}")
        return 0

# ==========================================
# 📚 ROMAN LİSTESİ (DOĞRUDAN DB)
# ==========================================
def get_active_novels():
    try:
        with engine.connect() as conn:
            # Sadece source_url olanları çek
            result = conn.execute(text("SELECT id, title, slug, source_url FROM novels WHERE source_url IS NOT NULL")).fetchall()
            return [dict(row._mapping) for row in result]
    except Exception as e:
        print(f"❌ Roman listesi hatası: {e}")
        return []

# ==========================================
# 🤖 AKILLI SELENIUM TABANLI BOT
# ==========================================
class AutoNovelBot:
    def __init__(self):
        print("🚀 Selenium başlatılıyor...")
        options = uc.ChromeOptions()
        options.add_argument("--start-maximized")
        options.add_argument("--disable-blink-features=AutomationControlled")
        # options.add_argument("--headless")  # İstersen aç
        self.driver = uc.Chrome(options=options, version_main=144)
        self.driver.set_page_load_timeout(60) # Cloudflare 524 için kısaltılmış timeout (Hızlı deneme için)
        print("✅ Chrome driver hazır!")
    
    def safe_get(self, url, max_retries=5):
        """Cloudflare 524/522 ve diğer timeoutları yöneten güvenli GET"""
        from selenium.common.exceptions import TimeoutException
        
        for attempt in range(max_retries):
            try:
                print(f"📡 Sayfaya gidiliyor (Deneme {attempt+1}/{max_retries}): {url}")
                self.driver.get(url)
                time.sleep(3) # Temel yükleme süresi
                
                # Cloudflare Hata Kontrolü
                try:
                    page_title = self.driver.title.lower()
                    page_source_lower = self.driver.page_source.lower()
                except:
                    page_title = ""
                    page_source_lower = ""
                
                # 🛑 Kalıcı hatalar - tekrar deneme ANLAMSIZ, hemen çık
                is_permanent_error = any(err in page_title or err in page_source_lower for err in [
                    "526",        # SSL sertifika hatası
                    "525",        # SSL Handshake hatası
                    "523",        # Origin unreachable
                    "521",        # Web server is down
                    "invalid ssl certificate",
                    "ssl handshake failed",
                ])
                if is_permanent_error:
                    print(f"🛑 Kalıcı hata tespit edildi (SSL/526 vb.) - bu hata tekrar denemeyle geçmez: {page_title}")
                    return False

                # Error 524, 522, 520, 504 (Gateway Timeout) - Geçici, tekrar denenebilir
                is_cf_error = any(err in page_title or err in page_source_lower for err in [
                    "error 524", "error 522", "error 520", "error 504",
                    "a timeout occurred", "ray id"
                ])
                
                # Turkish and English "Just a moment" variants
                is_waf = any(waf in page_source_lower or waf in page_title for waf in [
                    "checking your browser", "just a moment", "bir dakika lütfen", 
                    "doğrulama başarılı", "checking if the site connection is secure"
                ])
                
                if is_cf_error or (is_waf and len(page_source_lower) < 5000):
                    print(f"⚠️ Cloudflare Engeli/Hatası tespit edildi! (Title: {page_title}) {attempt+1}/{max_retries}")
                    if attempt < max_retries - 1:
                        wait_time = 15 * (attempt + 1)  # 15, 30, 45, 60sn (eskiden 20, 40, 60, 80)
                        print(f"⏳ {wait_time} saniye bekleniyor...")
                        time.sleep(wait_time)
                        continue
                    else:
                        print("❌ Maksimum deneme sayısına ulaşıldı.")
                        return False
                
                # Eğer sayfa hala WAF sayfasındaysa ama hata değilse, biraz daha bekle
                if is_waf:
                    print("🛡️ Cloudflare koruması bekletiyor, 15sn ek süre...")
                    time.sleep(15)
                    # Yeniden kontrol et
                    try:
                        new_source = self.driver.page_source.lower()
                        if any(waf in new_source for waf in ["bir dakika lütfen", "just a moment", "doğrulama başarılı"]):
                             print("⚠️ Hala WAF sayfasındayız, sayfa yenileniyor (Force reload)...")
                             self.driver.execute_script("window.location.reload();")
                             time.sleep(10)
                             continue
                    except: pass
                
                if len(self.driver.page_source) < 500:
                    print("⚠️ Sayfa içeriği çok kısa, bir şeyler yanlış gitmiş olabilir.")
                    time.sleep(5)
                
                return True
            except TimeoutException:
                print(f"⏰ Zaman aşımı (Deneme {attempt+1})")
                try:
                    self.driver.execute_script("window.stop();") # Yüklemeyi durdur
                except: pass
                
                if attempt < max_retries - 1:
                    time.sleep(10)
                    continue
            except Exception as e:
                print(f"❌ safe_get hatası: {e}")
                if attempt < max_retries - 1:
                    time.sleep(5)
                    continue
                return False
        return False

    def __del__(self):
        """Driver'ı temizle"""
        try:
            if hasattr(self, 'driver'):
                self.driver.quit()
                print("🔒 Browser kapatıldı.")
        except:
            pass


    def ensure_novel_metadata(self, novel):
        """
        Romanın eksik bilgilerini (Kapak, Yazar, Durum) tamamlar.
        Özellikle LightNovelPub için optimize edilmiştir.
        """
        try:
            print(f"🔍 Metadata kontrol ediliyor: {novel['title']}")
            
            # Eğer kapak resmi yoksa veya "default" ise
            # DB'den gelen veri dict olduğu için .get() ile kontrol et
            current_cover = novel.get('cover_image')
            
            # Eğer kapak resmi yoksa veya dosyası silinmişse
            # Kullanıcının yüklediği bir kapak varsa (ve dosya da duruyorsa) ASLA DOKUNMA!
            if not current_cover or not os.path.exists(os.path.join(BACKEND_DIR, str(current_cover))):
                print("🖼️ Kapak resmi veri tabanında yok veya dosyası silinmiş. Yeniden çekiliyor...")
                
                if not self.safe_get(novel['source_url']):
                    print("❌ Metadata için ana sayfa yüklenemedi.")
                    return
                
                # LightNovelPub & Genel Selectorlar
                cover_selectors = [
                    ".novel-cover img",       # LightNovelPub
                    ".book-cover img",        # Novelight
                    ".summary_image img",     # Genel WP
                    ".detail-info-cover img", # Madara
                    "img.cover"
                ]
                
                img_src = None
                for sel in cover_selectors:
                    try:
                        img = self.driver.find_element(By.CSS_SELECTOR, sel)
                        img_src = img.get_attribute("src") or img.get_attribute("data-src")
                        if img_src and "http" in img_src:
                            break
                    except:
                        continue
                
                if img_src:
                    print(f"🎯 Yeni kapak bulundu: {img_src}")
                    # Resmi İndir
                    try:
                        import requests
                        from PIL import Image
                        from io import BytesIO
                        
                        headers = {'User-Agent': 'Mozilla/5.0'}
                        resp = requests.get(img_src, headers=headers, timeout=10)
                        
                        if resp.status_code == 200:
                            img_data = BytesIO(resp.content)
                            image = Image.open(img_data)
                            
                            # Klasör oluştur
                            save_dir = os.path.join(BACKEND_DIR, "static", "novel_covers")
                            os.makedirs(save_dir, exist_ok=True)
                            
                            # Dosya adı (Slug ile)
                            file_ext = "jpg"
                            if image.format: file_ext = image.format.lower()
                            filename = f"{novel['slug']}-cover.{file_ext}"
                            file_path = os.path.join(save_dir, filename)
                            
                            image.save(file_path)
                            
                            # DB Update
                            relative_path = f"static/novel_covers/{filename}"
                            with engine.connect() as conn:
                                conn.execute(
                                    text("UPDATE novels SET cover_image = :path, is_published = TRUE WHERE id = :nid"),
                                    {"path": relative_path, "nid": novel['id']}
                                )
                                conn.commit()
                            print(f"✅ Kapak güncellendi: {relative_path}")
                            novel['cover_image'] = relative_path # Update local dict
                    except Exception as e:
                        print(f"❌ Resim indirme hatası: {e}")
                else:
                    print("⚠️ Kapak resmi sitede bulunamadı.")
            else:
                print("✅ Kapak resmi mevcut.")

        except Exception as e:
            print(f"⚠️ Metadata güncelleme hatası: {e}")

    def check_single_novel(self, novel):
        """
        Webtoon botundaki check_single_series mantığının novel versiyonu
        🚀 HYBRID: Ana sayfa için Selenium, bölümler için requests
        """
        print(f"\n{'='*60}")
        print(f"📚 ROMAN: {novel['title']}")
        print(f"🌐 Ana Sayfa: {novel['source_url']}")
        print(f"⚡ Mod: HYBRID (Selenium Liste + Requests İçerik)")
        print(f"{'='*60}")

        # 🔥 METADATA KONTROLÜ (Yeni Özellik)
        self.ensure_novel_metadata(novel)

        try:
            # 🛡️ CLOUDFLARE BYPASS NO.1: Önce ana sayfaya git
            url = novel['source_url']
            domain = "/".join(url.split("/")[:3]) # örn: https://lightnovelpub.me
            
            if "lightnovelpub" in url or "novelight" in url or "novellive" in url:
                print(f"🛡️ WAF Bypass: Önce ana sayfaya gidiliyor... ({domain})")
                try:
                    self.safe_get(domain)
                    import random
                    time.sleep(random.uniform(3, 6)) # İnsan gibi bekle
                except: pass

            # Ana sayfayı aç
            if not self.safe_get(url):
                print(f"❌ {url} yüklenemedi. Atlanıyor.")
                return
            
            print("⏳ Sayfa yükleniyor...")
            time.sleep(5)  # JavaScript yüklensin

            # Bölüm listesini topla
            chapter_links = self.get_chapter_links()
            
            if not chapter_links:
                print("⚠️ HATA: Bölüm listesi bulunamadı! Site yapısı tanımlanamadı.")
                return # Keep the return here
             # 🚀 Geliştirilmiş Filtreleme: DB'de eksik olan TÜM bölümleri bul (Gaps fix)
            with engine.connect() as conn:
                existing_chapters_rows = conn.execute(
                    text("SELECT chapter_number FROM novel_chapters WHERE novel_id = :nid"),
                    {"nid": novel['id']}
                ).fetchall()
                existing_chapters = [float(row[0]) for row in existing_chapters_rows]
            
            existing_set = set(existing_chapters)
            new_chapters = [ch for ch in chapter_links if float(ch['num']) not in existing_set]

            if not new_chapters:
                print(f"✅ {novel['title']} için tüm bölümler güncel.")
                return

            print(f"📦 {len(new_chapters)} yeni/eksik bölüm işlenecek.")
            
            # Yeni bölümleri sırayla işle (küçükten büyüğe)
            new_chapters.sort(key=lambda x: x['num'])
            
            for chapter in new_chapters:
                print(f"\n{'─'*50}")
                print(f"⬇️ İŞLENİYOR: Bölüm {chapter['num']}")
                print(f"🔗 Link: {chapter['url']}")
                
                # Bölümü çek ve çevir
                status = self.process_chapter(novel, chapter['num'], chapter['url'])
                
                if status is False:
                    print("🛑 KRİTİK: AI kotası doldu veya hata oluştu. Roman işleme durduruluyor.")
                    break
                elif status is True:
                    # İçerik bulundu ve işlendi (veya bulunamadı ama kota sorunu yok)
                    # translate_and_upload çağrıldıysa 60sn bekle, sadece atlandıysa 5sn bekle
                    if hasattr(self, '_last_translated') and self._last_translated:
                        print("⏳ Sonraki bölüme geçiliyor... (60sn bekleniyor - Gemini kota)")
                        time.sleep(60)
                        self._last_translated = False
                    else:
                        print("⏳ Bölüm atlandı, kısa bekleme (5sn)...")
                        time.sleep(5)

        except Exception as e:
            print(f"❌ Novel kontrol hatası: {e}")

    def get_chapter_links(self):
        """
        Webtoon botundaki selector_strategies mantığı
        Farklı site yapılarını deneyerek bölüm linklerini toplar
        🚀 GÜNCELLEME: LightNovelPub için pagination desteği eklendi.
        """
        # Novelight özel: "Tüm bölümleri göster" butonu varsa tıkla
        try:
            show_all_btn = self.driver.find_elements(By.CSS_SELECTOR, "#show-all-chapters")
            if show_all_btn:
                print("🔘 'Show all chapters' butonu bulundu, tıklanıyor...")
                self.driver.execute_script("arguments[0].click();", show_all_btn[0])
                time.sleep(3) # Listenin yüklenmesini bekle
        except Exception as e:
            print(f"⚠️ Buton tıklama hatası: {e}")

        # Novel siteleri için yaygın selector pattern'ları
        selector_strategies = [
             # Pattern 0: Novelight (Açıldıktan sonra)
            {"container": ".chapters .chapter", "link": "a", "text_loc": "", "is_self_link": True},

            # Pattern 0.5: LightNovelPub (Özel & İyileştirilmiş)
            {"container": ".chapter-list li", "link": "a", "text_loc": ".chapter-title"}, 
            {"container": ".chapter-list li", "link": "a", "text_loc": ""}, 
            {"container": ".ul-list5 li", "link": "a", "text_loc": ""}, 
            {"container": "tr[data-chapter]", "link": "a", "text_loc": ".chapter-name"},

            # Pattern 1: WP Manga tipi siteler
            {"container": ".wp-manga-chapter", "link": "a", "text_loc": ""},
            
            # Pattern 2: MangaStream tipi
            {"container": "#chapterlist li", "link": "a", "text_loc": ".chapternum"},
            
            # Pattern 3: Generic chapter list
            {"container": "#chapterlist li", "link": "a", "text_loc": ""},
            
            # Pattern 4: Madara tipi
            {"container": ".chapter-item", "link": "a", "text_loc": ".chapter-link"},
            
            # Pattern 5: Basit liste
            {"container": ".epsarchive ul li", "link": "a", "text_loc": ""},
            
            # Pattern 6: Custom chapter container
            {"container": "li.chapter", "link": "a", "text_loc": ""},
            
            # Pattern 7: Table based
            {"container": "table.table tr", "link": "a", "text_loc": ""},
        ]

        all_chapter_links = []
        base_url = self.driver.current_url.rstrip('/')
        print(f"🕵️ get_chapter_links başlatıldı. URL: {base_url}")
        print(f"📄 Sayfa Başlığı: {self.driver.title}")
        print(f"📏 Kaynak Uzunluğu: {len(self.driver.page_source)}")
        
        # 🚀 LNP/NovelLive ÖZEL: requests kütüphanesi ile bölüm listesini çek
        is_lnp = "lightnovelpub.me" in base_url.lower() or "novellive.app" in base_url.lower()
        if is_lnp:
            try:
                from bs4 import BeautifulSoup
                import requests as _req

                # Selenium'un Cloudflare cookie'lerini al
                sel_cookies = {c['name']: c['value'] for c in self.driver.get_cookies()}
                headers = {
                    "User-Agent": self.driver.execute_script("return navigator.userAgent;"),
                    "Referer": base_url,
                    "Accept": "text/html,application/xhtml+xml",
                }

                book_path = base_url.split("lightnovelpub.me")[-1].split("novellive.app")[-1].rstrip("/")
                lnp_links = []
                page_num = 1
                max_lnp_pages = 30

                while page_num <= max_lnp_pages:
                    if page_num == 1:
                        page_url = f"https://lightnovelpub.me{book_path}"
                    else:
                        page_url = f"https://lightnovelpub.me{book_path}/{page_num}"

                    print(f"🌐 LNP requests çekiliyor: {page_url}")
                    try:
                        r = _req.get(page_url, cookies=sel_cookies, headers=headers, timeout=20)
                        if r.status_code != 200:
                            print(f"⚠️ HTTP {r.status_code}, durduruluyor.")
                            break
                        soup = BeautifulSoup(r.text, "html.parser")
                        items = soup.select(".ul-list5 li a")
                        if not items:
                            items = soup.select(".chapter-list li a")
                        if not items:
                            print(f"⚠️ Sayfa {page_num}'de liste bulunamadı, durduruluyor.")
                            break

                        new_found = 0
                        for a_tag in items:
                            href = a_tag.get("href", "")
                            if not href.startswith("http"):
                                href = "https://lightnovelpub.me" + href
                            text = a_tag.get_text(strip=True)
                            m = re.search(r"(\d+(\.\d+)?)", text)
                            if m:
                                ch_num = float(m.group(1))
                                if not any(ch['num'] == ch_num for ch in lnp_links):
                                    lnp_links.append({"num": ch_num, "url": href})
                                    new_found += 1

                        print(f"   ✅ Sayfa {page_num}: {new_found} yeni bölüm ({len(lnp_links)} toplam)")

                        # Sonraki sayfa var mı?
                        next_el = soup.select_one(".page a.next, li.next a, a[title*='Next']")
                        if not next_el:
                            # Metin bazlı kontrol
                            for a in soup.select(".page a"):
                                if "next" in a.get_text(strip=True).lower():
                                    next_el = a
                                    break
                        if next_el:
                            page_num += 1
                        else:
                            break
                    except Exception as req_err:
                        print(f"⚠️ requests hatası sayfa {page_num}: {req_err}")
                        break

                if lnp_links:
                    lnp_links.sort(key=lambda x: x['num'])
                    print(f"🎯 LNP requests ile {len(lnp_links)} bölüm toplandı!")
                    return lnp_links
                else:
                    print("⚠️ LNP requests boş döndü, Selenium yoluna devam ediliyor...")
            except Exception as lnp_e:
                print(f"⚠️ LNP requests hatası: {lnp_e}")

        
        current_page = 1
        max_pages = 25
        visited_urls = set()  # 🔒 Sonsuz döngü engeli

        def normalize_url(u):
            """lightnovelpub.me ve novellive.app aynı site - normalize et"""
            return u.replace("novellive.app", "lightnovelpub.me").rstrip("/")

        while current_page <= max_pages:
            found_items = []
            active_strategy = None

            # Her stratejiyi dene
            for strategy in selector_strategies:
                try:
                    items = self.driver.find_elements(By.CSS_SELECTOR, strategy["container"])
                    if items and len(items) > 0:
                        found_items = items
                        active_strategy = strategy
                        print(f"🔧 {len(items)} satır bulundu ({strategy['container']})")
                        break
                except:
                    continue

            if not found_items:
                if current_page == 1:
                    print(f"⚠️ Hiçbir selector pattern çalışmadı! URL: {self.driver.current_url}")
                    print(f"🔍 Sayfa başlığı: {self.driver.title}")
                    if "bir dakika" in self.driver.title.lower() or "just a moment" in self.driver.title.lower():
                        print("🛑 HALA CLOUDFLARE SAYFASINDAYIZ! safe_get geçememiş.")
                    try:
                        self.driver.save_screenshot("debug_lnp_fail.png")
                        with open("debug_lnp_fail.html", "w", encoding="utf-8") as f:
                            f.write(self.driver.page_source)
                    except: pass
                break

            # Linkleri bu sayfadan topla
            page_links_count = 0
            for item in found_items:
                try:
                    if active_strategy.get("is_self_link"):
                        if item.tag_name == 'a':
                            link = item.get_attribute("href")
                        else:
                            link = item.find_element(By.TAG_NAME, "a").get_attribute("href")
                    else:
                        link = item.find_element(By.CSS_SELECTOR, active_strategy["link"]).get_attribute("href")
                    
                    if not link or not link.startswith("http"):
                        if page_links_count == 0 and current_page == 1:
                            print(f"   🐛 DEBUG link skip: '{link}'")
                        continue

                    raw_text = ""
                    if active_strategy["text_loc"]:
                        try:
                            raw_text = item.find_element(By.CSS_SELECTOR, active_strategy["text_loc"]).text.strip()
                        except:
                            raw_text = item.text.strip()
                    else:
                        raw_text = item.text.strip() or item.find_element(By.TAG_NAME, "a").get_attribute("textContent").strip()

                    match = re.search(r"(\d+(\.\d+)?)", raw_text)
                    if match:
                        chapter_num = float(match.group(1))
                        # Mükerrer kontrolü
                        if not any(ch['num'] == chapter_num for ch in all_chapter_links):
                            all_chapter_links.append({"num": chapter_num, "url": link})
                            page_links_count += 1
                        
                except Exception as item_err:
                    print(f"   🐛 DEBUG item_err (ilk): {type(item_err).__name__}: {item_err}")
                    continue

            # 📄 Sayfalama (Pagination) Mantığı Veri Toplama: 
            try:
                # Sayfadaki "Next" veya "Sonraki" butonunu bulmayı dene
                selectors = [
                    ".page a.next", ".page .next a", "a[title*='Next']", 
                    ".pagination-next", ".pagination .next a", "li.next a", 
                    "a.next-page", "a.index-container-btn"
                ]
                potential_next_elements = []
                for sel in selectors:
                    potential_next_elements.extend(self.driver.find_elements(By.CSS_SELECTOR, sel))
                
                next_url = None
                for el in potential_next_elements:
                    txt = el.text.strip().lower()
                    title = (el.get_attribute("title") or "").lower()
                    if "next" in txt or "sonraki" in txt or ">" in txt or "next" in title:
                        next_url = el.get_attribute("href")
                        if next_url:
                            norm_next = normalize_url(next_url)
                            norm_current = normalize_url(self.driver.current_url)
                            if norm_next != norm_current and norm_next not in visited_urls:
                                print(f"🔗 'Next' butonu metin ile bulundu: {txt} -> {next_url}")
                                break
                            else:
                                next_url = None  # Ziyaret edilmiş veya aynı sayfa
                
                # Fallback: URL'den tahmin et
                if not next_url:
                    current_page += 1
                    # LNP için /chapters/page-2 yaygın
                    if "chapters" in base_url.lower():
                        if "/page-" in base_url:
                            next_url = re.sub(r'page-\d+', f'page-{current_page}', base_url)
                        else:
                            next_url = f"{base_url.rstrip('/')}/page-{current_page}"
                    else:
                        # Bazı LNP versiyonlarında /x direkt çalışır
                        next_url = f"{base_url.rstrip('/')}/{current_page}"
                
                if next_url and normalize_url(next_url) not in visited_urls:
                    visited_urls.add(normalize_url(self.driver.current_url))
                    print(f"📄 Sonraki sayfaya geçiliyor: {next_url}")
                    if not self.safe_get(next_url):
                        print(f"⚠️ Sayfa {current_page} yüklenemedi. Durduruluyor.")
                        break
                    
                    time.sleep(12) 
                    
                    # Sayfa değişimini kontrol et (Hata ayıklama için kaydet)
                    try:
                        new_items = self.driver.find_elements(By.CSS_SELECTOR, active_strategy["container"])
                        if not new_items:
                            print(f"⚠️ Sayfa {current_page} boş! Kaydediliyor...")
                            with open(f"debug_lnp_p{current_page}.html", "w", encoding="utf-8") as f:
                                f.write(self.driver.page_source)
                    except: pass
                else:
                    print("🛑 Sonraki sayfa linki bulunamadı veya aynı sayfa. Bitiyor.")
                    break 
            except Exception as paging_e:
                print(f"⚠️ Sayfalama hatası: {paging_e}")
                break

        # İşlem bittiğinde özet bilgi ver
        print(f"🔢 DEBUG: get_chapter_links bitti. all_chapter_links içinde {len(all_chapter_links)} bölüm var.")
        if all_chapter_links:
            all_chapter_links.sort(key=lambda x: x['num'])
            print(f"✅ Toplam {len(all_chapter_links)} bölüm toplandı. (Aralık: {all_chapter_links[0]['num']} - {all_chapter_links[-1]['num']})")

        return all_chapter_links

    def process_chapter(self, novel, chapter_num, chapter_url):
        """
        Bölümü çek, çevir ve kaydet
        🚀 HIZ OPTİMİZASYONU: Önce requests dener, olmazsa Selenium'a düşer (Fallback)
        """
        try:
            # Önce DB'de var mı kontrol et
            with engine.connect() as conn:
                check = conn.execute(
                    text("SELECT id FROM novel_chapters WHERE novel_id = :nid AND chapter_number = :cnum"),
                    {"nid": novel['id'], "cnum": chapter_num}
                ).fetchone()
                
                if check:
                    print(f"⏩ Bölüm {chapter_num} zaten var. Atlanıyor...")
                    return

            # 1. YÖNTEM: Requests (Hızlı) - Selenium cookie'leri ile WAF bypass
            print("⚡ İçerik çekiliyor (Mod: Requests)...")
            content_found = False
            title_text = f"Bölüm {chapter_num}"
            text_content = ""

            # Selenium'dan Cloudflare cookie'leri al
            try:
                sel_cookies = {c['name']: c['value'] for c in self.driver.get_cookies()}
                sel_ua = self.driver.execute_script("return navigator.userAgent;")
            except:
                sel_cookies = {}
                sel_ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

            # Site domain'ini Referer olarak kullan
            domain = "/".join(chapter_url.split("/")[:3])
            headers = {
                'User-Agent': sel_ua,
                'Referer': domain + "/",
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
            }
            
            # 🚀 Novelight API (ÖNCELİKLİ)
            if "novelight.net" in chapter_url:
                try:
                    import re
                    chapter_id_match = re.search(r'chapter/(\d+)', chapter_url) or re.search(r'chapter-(\d+)', chapter_url)
                    if chapter_id_match:
                        chapter_id = chapter_id_match.group(1)
                        api_url = f"https://novelight.net/book/ajax/read-chapter/{chapter_id}"
                        print(f"📡 Novelight API çağrılıyor... ({chapter_id})")
                        api_resp = requests.get(api_url, headers=headers, timeout=10)
                        if api_resp.status_code == 200:
                            data = api_resp.json()
                            if 'content' in data:
                                content_soup = BeautifulSoup(data['content'], 'html.parser')
                                for bad in content_soup.find_all(['script', 'style', 'div', 'a', 'iframe', 'button', 'input']):
                                    if bad.name != 'div': 
                                        bad.decompose()
                                text_content = content_soup.get_text(separator="\n\n").strip()
                                if text_content:
                                    content_found = True
                                    print(f"✅ İçerik Novelight API ile çekildi! ({len(text_content)} karakter)")
                except Exception as api_e:
                     print(f"⚠️ Novelight API hatası: {api_e}")

           
            try:
                if not content_found:
                    response = requests.get(chapter_url, headers=headers, cookies=sel_cookies, timeout=15)
                
                    # Cloudflare veya Koruma kontrolü (403/503)
                    if response.status_code in [403, 503]:
                        print(f"⚠️ Requests engellendi ({response.status_code}). Selenium'a geçiliyor...")
                        raise Exception("Korumalı Site")
                    
                    if response.status_code == 404:
                        print(f"⚠️ Bölüm {chapter_num} bulunamadı (404)")
                        return
                    
                    if response.status_code == 200:
                        # 🛡️ KORUMA 1: Yönlendirme (Redirect) Algılayıcı
                        final_url = response.url.rstrip('/')
                        requested_url = chapter_url.rstrip('/')
                        if final_url != requested_url:
                            print(f"🚨 HAYALET BÖLÜM TESPİT EDİLDİ! (Yönlendirme)")
                            print(f"   İstenen : {requested_url}")
                            print(f"   Gidilen  : {final_url}")
                            print(f"🛑 Bölüm {chapter_num} yok. Seri tamamlandı kabul ediliyor.")
                            return True  # İçerik yok, ama kota hatası değil — döngüyü kır

                        soup = BeautifulSoup(response.text, 'html.parser')
                        
                        # Başlığı bul
                        title_tag = soup.find('h1') or soup.find('h2') or soup.find('h3', class_='title')
                        if title_tag:
                             title_text = title_tag.get_text(strip=True)

                        # Standart İçerik containerlarını dene
                        if not content_found:
                            content = soup.select_one('.chapter-text') or \
                                      soup.select_one('.txt') or \
                                      soup.select_one('#chapter-container') or \
                                      soup.select_one('.entry-content') or \
                                      soup.select_one('.cha-content') or \
                                      soup.select_one('.reading-content') or \
                                      soup.select_one('.chapter-content') or \
                                      soup.select_one('#chapter-content') or \
                                      soup.select_one('#chr-content') or \
                                      soup.select_one('.text-left') or \
                                      soup.select_one('article')

                            if content:
                                # Gereksiz elementleri temizle
                                for bad in content.find_all(['script', 'style', 'div', 'a', 'iframe', 'button', 'input']):
                                    bad.decompose()

                                text_content = content.get_text(separator="\n\n").strip()
                                
                                # 🛡️ KORUMA 2: Minimum Karakter Sayısı Kontrolü
                                if len(text_content) < MIN_CHAPTER_LENGTH:
                                    print(f"🚨 HAYALET BÖLÜM TESPİT EDİLDİ! (Çok Kısa İçerik: {len(text_content)} karakter)")
                                    print(f"   Önizleme: '{text_content[:200]}'")
                                    print(f"🛑 Bölüm {chapter_num} yok. Seri tamamlandı kabul ediliyor.")
                                    return True

                                # 🛡️ KORUMA 3: Sahte İçerik Anahtar Kelime Filtresi
                                text_lower = text_content.lower()
                                ghost_keyword = next((kw for kw in GHOST_CHAPTER_KEYWORDS if kw in text_lower), None)
                                if ghost_keyword:
                                    print(f"🚨 HAYALET BÖLÜM TESPİT EDİLDİ! (Sahte Kelime: '{ghost_keyword}')")
                                    print(f"🛑 Bölüm {chapter_num} yok. Seri tamamlandı kabul ediliyor.")
                                    return True

                                content_found = True
                                print(f"✅ İçerik requests ile çekildi! ({len(text_content)} karakter)")
                            else:
                                print("⚠️ İçerik bulunamadı, Selenium deneniyor...")

            except Exception as e:
                print(f"⚠️ Requests başarısız: {e}")
                # Hata durumunda Selenium'a devam et

            # 2. YÖNTEM: Selenium (Yavaş ama Güçlü - Fallback)
            if not content_found:
                print("🐢 Selenium Moduna Geçiliyor (Cloudflare/JS Handling)...")
                try:
                    # 🔥 KRİTİK: safe_get kullan (WAF bypass mantığı ile)
                    # Doğrudan driver.get() yerine safe_get() - Cloudflare cookie'leri korunuyor
                    success = self.safe_get(chapter_url)
                    
                    if not success:
                        print("❌ Selenium: Sayfa yüklenemedi (safe_get başarısız)")
                    else:
                        # İçeriğin yüklenmesini bekle (JS render için)
                        print("⏳ İçerik yükleniyor (15sn)...")
                        time.sleep(15)
                        
                        # Olası içerik selectorları - LightNovelPub öncelikli
                        selectors = [
                            ".m-read .txt",           # LightNovelPub klasik
                            ".reading-content .text-left",  # LightNovelPub alternatif
                            ".chapter-reading-content",      # LNP yeni yapı
                            "#chr-content",                  # LNP ID
                            ".chr-text",                     # LNP class
                            ".chapter-c",                    # LNP alternatif
                            ".chapter-text",                 # Novelight
                            ".txt",                          # Generic
                            "#chapter-container",
                            ".entry-content",
                            ".cha-content",
                            ".chapter-content",
                            "#chapter-content",
                            "[class*='chapter'][class*='text']",  # Wildcard
                            "[class*='read'][class*='content']",  # Wildcard
                        ]
                        
                        found_element = None
                        for sel in selectors:
                            try:
                                elem = self.driver.find_element(By.CSS_SELECTOR, sel)
                                if elem and len(elem.text) > 50:
                                    found_element = elem
                                    print(f"🔧 Selenium Selector Buldu: {sel}")
                                    break
                            except:
                                continue
                        
                        # Selector bulunamadıysa body içinden metin çıkarmayı dene
                        if not found_element:
                            print("⚠️ Selector bulunamadı. JS ile sayfa yapısı kontrol ediliyor...")
                            try:
                                # Sayfanın tüm text node'larını topla
                                page_source = self.driver.page_source
                                temp_soup = BeautifulSoup(page_source, 'html.parser')
                                # Script/style temizle
                                for bad in temp_soup.find_all(['script', 'style', 'nav', 'header', 'footer']):
                                    bad.decompose()
                                # En uzun metin bloğunu bul (muhtemelen içerik)
                                candidates = []
                                for tag in temp_soup.find_all(['div', 'article', 'section', 'main']):
                                    t = tag.get_text(separator='\n', strip=True)
                                    if len(t) > 500:
                                        candidates.append((len(t), tag.get('class', []), t))
                                if candidates:
                                    candidates.sort(key=lambda x: x[0], reverse=True)
                                    best = candidates[0]
                                    print(f"🔍 BS4 ile en uzun blok bulundu: {best[1]} ({best[0]} karakter)")
                                    text_content = best[2]
                                    # 🛡️ KORUMA 2+3: BS4 fallback için de aynı kontroller
                                    if len(text_content) >= MIN_CHAPTER_LENGTH:
                                        text_lower = text_content.lower()
                                        ghost_kw = next((kw for kw in GHOST_CHAPTER_KEYWORDS if kw in text_lower), None)
                                        if ghost_kw:
                                            print(f"🚨 HAYALET BÖLÜM (BS4 Fallback - Sahte Kelime: '{ghost_kw}')")
                                        else:
                                            content_found = True
                                            print(f"✅ İçerik BS4 fallback ile çekildi! ({len(text_content)} karakter)")
                                    else:
                                        print(f"🚨 HAYALET BÖLÜM (BS4 Fallback - Çok Kısa: {len(text_content)} karakter)")
                            except Exception as bs_e:
                                print(f"⚠️ BS4 fallback hatası: {bs_e}")
                        
                        if found_element:
                            # Metni JS ile al (innerText daha temiz)
                            text_content = self.driver.execute_script("return arguments[0].innerText;", found_element)
                            
                            # Başlığı da Selenium ile al
                            try:
                                title_elem = self.driver.find_element(By.TAG_NAME, "h1")
                                title_text = title_elem.text.strip()
                            except:
                                pass
                                
                            # 🛡️ KORUMA 2+3: Selenium içeriği için de aynı kontroller
                            if len(text_content) >= MIN_CHAPTER_LENGTH:
                                text_lower = text_content.lower()
                                ghost_kw = next((kw for kw in GHOST_CHAPTER_KEYWORDS if kw in text_lower), None)
                                if ghost_kw:
                                    print(f"🚨 HAYALET BÖLÜM (Selenium - Sahte Kelime: '{ghost_kw}')")
                                else:
                                    content_found = True
                                    print(f"✅ İçerik Selenium ile çekildi! ({len(text_content)} karakter)")
                            else:
                                print(f"🚨 HAYALET BÖLÜM (Selenium - Çok Kısa: {len(text_content)} karakter)")
                        
                        if not content_found:
                            # Debug için sayfayı kaydet
                            print("❌ Selenium da içerik bulamadı!")
                            try:
                                self.driver.save_screenshot(f"debug_chapter_{chapter_num}.png")
                                print(f"📸 Screenshot kaydedildi: debug_chapter_{chapter_num}.png")
                                print(f"🔍 Sayfa başlığı: {self.driver.title}")
                                print(f"📏 Kaynak uzunluğu: {len(self.driver.page_source)}")
                            except: pass

                except Exception as sel_e:
                    print(f"❌ Selenium hatası: {sel_e}")

            # Sonuç Kontrolü ve Kayıt
            if content_found and text_content:
                return self.translate_and_upload(novel, chapter_num, title_text, text_content)
            else:
                print(f"❌ Başarısız: Bölüm {chapter_num} içeriği hiçbir yöntemle alınamadı. (Atlanıyor)")
                return True # İçerik bulunamadı ama kota sorunu değil, devam et (kısa bekleme)

        except Exception as e:
            print(f"❌ Bölüm işleme genel hatası: {e}")

    def translate_and_upload(self, novel, chapter_num, eng_title, eng_text):
        """
        Gemini ile çevir ve DB'ye kaydet.
        Başarılıysa True, kota/hata nedeniyle yapılamadıysa False döner.
        """
        print(f"🤖 AI Çeviriyor: {eng_title}...")

        novel_title = novel.get('title', 'default')
        selected_glossary = NOVEL_CONFIGS.get("default")
        
        for key in NOVEL_CONFIGS:
            if key.lower() in novel_title.lower():
                selected_glossary = NOVEL_CONFIGS[key]
                print(f"📖 '{key}' sözlüğü aktif.")
                break
                
        system_instruction = f"""
Sen, profesyonel bir fantastik roman çevirmenisin. Türk okuyucusu için akıcı, epik ve edebi bir dille Türkçeye çeviri yaparsın.

KRİTİK KURALLAR:
1. SADECE ÇEVİRİ METNİNİ DÖNDÜR. 
2. ASLA "Tabii ki", "Elbette", "İşte çeviri", "Merhaba" gibi giriş cümleleri kurma. 
3. ASLA metin hakkında açıklama yapma.
4. Çeviride "{selected_glossary}" terimlerini kullan.

GÖREV: Aşağıdaki metni Türkçeye çevir:
{eng_text}
"""

        ceviri = None
        max_cycles = 3 # Tüm keyler bittikten sonra max 3 kez 65sn bekle
        
        for cycle in range(max_cycles):
            for i in range(len(GOOGLE_API_KEYS)):
                try:
                    print(f"🔑 Key #{_current_key_index + 1} ile çeviriliyor... (Döngü {cycle+1}/{max_cycles})")
                    active_client = get_gemini_client()
                    response = active_client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=system_instruction
                    )
                    raw_ceviri = response.text.strip()
                    
                    # AI sohbet temizliği
                    lines = raw_ceviri.split('\n')
                    cleaned_lines = []
                    found_story_start = False
                    chat_keywords = ["elbette", "tabii", "işte", "çeviri", "sure,", "certainly", "here is", "ok,", "tamam", "çevirdim", "kimliğimle"]
                    
                    for idx, line in enumerate(lines):
                        l_strip = line.strip().lower()
                        if found_story_start:
                            cleaned_lines.append(line)
                            continue
                        if idx < 5:
                            if any(k in l_strip for k in chat_keywords) or not l_strip:
                                continue
                            found_story_start = True
                            cleaned_lines.append(line)
                        else:
                            cleaned_lines.append(line)
                    
                    ceviri = '\n'.join(cleaned_lines).strip()
                    
                    if len(ceviri) > 50:
                        print(f"✅ Çeviri başarılı! ({len(ceviri)} karakter)")
                        break # İç döngüden çık (key döngüsü)
                    
                except Exception as e:
                    if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                        print(f"⚠️ Key #{_current_key_index + 1} kota aşıldı.")
                        rotate_key()
                    else:
                        print(f"❌ Çeviri hatası: {e}")
                        return False # Kritik hata

            if ceviri:
                break # Dış döngüden çık (cycle döngüsü)
                
            # Eğer buradaysak tüm keyler 429 verdi
            wait_time = 65
            print(f"⏳ Tüm API anahtarları doldu. {wait_time} saniye bekleniyor... ({cycle+1}/{max_cycles})")
            time.sleep(wait_time)

        if not ceviri:
            print("❌ HATA: Tüm denemeler sonunda çeviri yapılamadı. İngilizce kaydedilmiyor, işlem durdurulacak.")
            return False

        try:
            # Temizlik
            if "İşte çeviriniz" in ceviri or "Çeviri:" in ceviri:
                ceviri = ceviri.replace("İşte çeviriniz:", "").replace("Çeviri:", "").strip()
            
            with engine.connect() as conn:
                result = conn.execute(
                    text("""
                        INSERT INTO novel_chapters (novel_id, chapter_number, title, content, view_count, is_published, created_at)
                        VALUES (:nid, :cnum, :title, :content, 0, TRUE, NOW())
                        ON CONFLICT (novel_id, chapter_number) DO NOTHING
                    """),
                    {
                        "nid": novel['id'],
                        "cnum": chapter_num,
                        "title": eng_title,
                        "content": ceviri
                    }
                )
                conn.commit()
                if result.rowcount > 0:
                    print(f"🎉 Bölüm {chapter_num} BAŞARIYLA KAYDEDİLDİ!")
                    self._last_translated = True  # 60sn bekleme için flag
                    return True
                else:
                    print(f"⏩ Bölüm {chapter_num} zaten mevcut, atlandı.")
                    return True
                
        except Exception as e:
            print(f"❌ Veritabanı Kayıt Hatası: {e}")
            return False

    def get_or_create_novel(self, url):
        """
        Verilen URL'deki romanı veritabanında bulur veya yoksa oluşturur.
        """
        try:
            # URL'den basit bir slug türet (Yedek olarak)
            url_slug = url.strip("/").split("/")[-1]
            
            # 1. Önce URL ile DB kontrolü
            with engine.connect() as conn:
                novel = conn.execute(
                    text("SELECT * FROM novels WHERE source_url = :url"),
                    {"url": url}
                ).mappings().fetchone()
            
            if novel:
                print(f"✅ Roman veritabanında mevcut: {novel['title']}")
                return dict(novel)

            # 2. Yoksa siteye git ve verileri çek
            print(f"🆕 Yeni roman keşfedildi! Oluşturuluyor: {url}")
            self.driver.get(url)
            time.sleep(5)
            
            title = "Bilinmeyen Roman"
            cover_src = None
            author = "Anonim"
            summary = "Özet yok."
            
            # A. Başlık Çekme (Daha Robust)
            try:
                # Başlığın gelmesini bekle (Maks 10sn)
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "h1"))
                )
                
                # Olası başlık ve yazar selectorları
                title_selectors = ["h1", ".novel-title", ".post-title", "h2.title"]
                author_selectors = [".author", ".novel-author a", ".author-content a"]
                
                for sel in title_selectors:
                    try:
                        t = self.driver.find_element(By.CSS_SELECTOR, sel).text.strip()
                        if t and len(t) > 2:
                            title = t
                            print(f"✅ Başlık Bulundu: {title}")
                            break
                    except: continue

                for sel in author_selectors:
                    try:
                        a = self.driver.find_element(By.CSS_SELECTOR, sel).text.strip()
                        if a:
                            author = a
                            break
                    except: continue

            except Exception as e:
                print(f"⚠️ Başlık/Yazar çekilemedi: {e}")

            # B. Slug Oluşturma (Title'dan)
            slug = slugify(title)
            # Eğer slug boşsa veya çakışırsa URL'den al
            if not slug or title == "Bilinmeyen Roman": 
                slug = url_slug
                title = title if title != "Bilinmeyen Roman" else url_slug.replace("-", " ").title()

            # C. Kapak Çekme
            cover_selectors = [".novel-cover img", ".book-cover img", ".summary_image img", "img.cover"]
            for sel in cover_selectors:
                try:
                    img = self.driver.find_element(By.CSS_SELECTOR, sel)
                    cover_src = img.get_attribute("src")
                    if cover_src: break
                except: continue

            # Resmi İndir
            cover_path = None
            if cover_src:
                try:
                    import requests
                    from PIL import Image
                    from io import BytesIO
                    resp = requests.get(cover_src, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
                    if resp.status_code == 200:
                        img_data = BytesIO(resp.content)
                        image = Image.open(img_data)
                        save_dir = os.path.join(BACKEND_DIR, "static", "novel_covers")
                        os.makedirs(save_dir, exist_ok=True)
                        filename = f"{slug}-cover.jpg"
                        image.save(os.path.join(save_dir, filename))
                        cover_path = f"static/novel_covers/{filename}"
                except Exception as e:
                    print(f"⚠️ Kapak indirilemedi: {e}")

            # D. DB'ye Kaydet (is_published = FALSE)
            with engine.connect() as conn:
                # Slug kontrolü (Unique)
                existing = conn.execute(text("SELECT id FROM novels WHERE slug = :slug"), {"slug": slug}).fetchone()
                if existing:
                    slug = f"{slug}-{int(time.time())}" # Unique yap
                
                new_id_result = conn.execute(
                    text("""
                        INSERT INTO novels (title, slug, summary, author, source_url, cover_image, status, is_published, created_at)
                        VALUES (:title, :slug, :summary, :author, :url, :cover, 'ongoing', FALSE, NOW())
                        RETURNING id
                    """),
                    {
                        "title": title, "slug": slug, "summary": summary, 
                        "author": author, "url": url, "cover": cover_path
                    }
                ).fetchone()
                conn.commit()
                new_id = new_id_result[0]
                
            print(f"🎉 Yeni Roman Oluşturuldu: {title} (ID: {new_id})")
            print(f"⚠️ DİKKAT: Yayın durumu 'FALSE' (Taslak). Admin panelinden yayınlamanız gerekir.")
            
            return {
                "id": new_id, "title": title, "slug": slug, 
                "source_url": url, "cover_image": cover_path
            }

        except Exception as e:
            print(f"❌ Roman oluşturma hatası: {e}")
            return None

# ==========================================
# 🚀 ANA ÇALIŞTIRMA BLOĞU
# ==========================================
def main():
    print("╔════════════════════════════════════════════╗")
    print("║  🏭 NOVEL FABRİKASI (FILE MODE)           ║")
    print("║  📄 Kaynak: novelseriler.txt               ║")
    print("╚════════════════════════════════════════════╝\n")

    bot = AutoNovelBot()

    while True:
        try:
            # novelseriler.txt dosyasını oku
            txt_path = os.path.join(CURRENT_DIR, "novelseriler.txt")
            if not os.path.exists(txt_path):
                print(f"⚠️ Dosya bulunamadı: {txt_path}")
                time.sleep(60)
                continue

            with open(txt_path, "r", encoding="utf-8") as f:
                urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]

            if not urls:
                print("⚠️ Dosya boş. URL ekleyin.")
                time.sleep(60)
                continue

            print(f"\n📋 Dosyada {len(urls)} URL bulundu. İşleniyor...\n")

            for url in urls:
                novel = bot.get_or_create_novel(url)
                
                if novel:
                    # Bölümleri kontrol et
                    bot.check_single_novel(novel)
                
                print(f"\n⏸️ Sonraki romana geçiliyor...\n")
                time.sleep(5) 

            print(f"\n{'='*60}")
            print(f"💤 Liste tamamlandı. Bot {BEKLEME_SURESI} saniye dinleniyor...")
            print(f"{'='*60}\n")
            time.sleep(BEKLEME_SURESI)

        except KeyboardInterrupt:
            print("\n⛔ Bot durduruldu.")
            break
        except Exception as e:
            print(f"❌ Ana döngü hatası: {e}")
            time.sleep(30)

if __name__ == "__main__":
    main()