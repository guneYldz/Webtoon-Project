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
    "default": """
        1. Özel isimleri (Karakter adları, şehir adları) ASLA çevirme.
        2. Büyü isimlerini mümkünse Türkçe karşılığıyla, parantez içinde İngilizcesi olacak şekilde çevir.
        3. Ton: Edebi, akıcı ve romanın türüne uygun.
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

    
}

# ==========================================
# 🔍 EN SON BÖLÜMÜ ÖĞREN (DOĞRUDAN DB)
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
        print("✅ Chrome driver hazır!")

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
                
                self.driver.get(novel['source_url'])
                time.sleep(5)
                
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
            
            if "lightnovelpub" in url or "novelight" in url:
                print(f"🛡️ WAF Bypass: Önce ana sayfaya gidiliyor... ({domain})")
                try:
                    self.driver.get(domain)
                    import random
                    time.sleep(random.uniform(3, 6)) # İnsan gibi bekle
                except: pass

            # Ana sayfayı aç
            self.driver.get(url)
            print("⏳ Sayfa yükleniyor...")
            time.sleep(5)  # JavaScript yüklensin

            # Bölüm listesini topla
            chapter_links = self.get_chapter_links()
            
            if not chapter_links:
                print("⚠️ HATA: Bölüm listesi bulunamadı! Site yapısı tanımlanamadı.")
                return 

            print(f"📋 Toplam {len(chapter_links)} bölüm bulundu!")

            # DB'den son bölümü öğren
            last_chapter = get_last_chapter_number(novel['id'])
            print(f"💾 Veritabanındaki son bölüm: {last_chapter}")

            # Yeni bölümleri filtrele
            new_chapters = [ch for ch in chapter_links if ch['num'] > last_chapter]

            if not new_chapters:
                print(f"✅ Durum: GÜNCEL. Tüm bölümler zaten mevcut.")
                return

            print(f"🚀 {len(new_chapters)} YENİ BÖLÜM YAKALANDI!")

            # Yeni bölümleri sırayla işle (küçükten büyüğe)
            new_chapters.sort(key=lambda x: x['num'])
            
            for chapter in new_chapters:
                print(f"\n{'─'*50}")
                print(f"⬇️ İŞLENİYOR: Bölüm {chapter['num']}")
                print(f"🔗 Link: {chapter['url']}")
                
                # Bölümü çek ve çevir
                self.process_chapter(novel, chapter['num'], chapter['url'])
                
                print("⏳ Sonraki bölüme geçiliyor... (60sn bekleniyor - Gemini kota)")
                time.sleep(60)  # Gemini free tier: dakikada 15 istek

        except Exception as e:
            print(f"❌ Novel kontrol hatası: {e}")

    def get_chapter_links(self):
        """
        Webtoon botundaki selector_strategies mantığı
        Farklı site yapılarını deneyerek bölüm linklerini toplar
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
            {"container": ".chapter-list li", "link": "a", "text_loc": ".chapter-title"}, # LightNovelPub updated
            {"container": ".ul-list5 li", "link": "a", "text_loc": ""}, # Old LightNovelPub

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

        found_items = []
        active_strategy = None

        # Her stratejiyi dene
        for strategy in selector_strategies:
            try:
                items = self.driver.find_elements(By.CSS_SELECTOR, strategy["container"])
                if items and len(items) > 0:
                    found_items = items
                    active_strategy = strategy
                    print(f"🔧 Site Yapısı Tespit Edildi: {strategy['container']} ({len(items)} bölüm)")
                    break
            except:
                continue

        if not found_items:
            print("⚠️ Hiçbir selector pattern çalışmadı!")
            print(f"PAGE TITLE: {self.driver.title}")
            try:
                # Debug için kaydet
                with open("debug_fail_source.html", "w", encoding="utf-8") as f:
                    f.write(self.driver.page_source)
                self.driver.save_screenshot("debug_fail.png")
                print("📸 Debug resim ve kaynak kodu kaydedildi (debug_fail.png, debug_fail_source.html)")
            except: pass
            return []

        # Linkleri topla
        chapter_links = []
        for item in found_items:
            try:
                # Linki bul
                if active_strategy.get("is_self_link"):
                    link_elem = item
                    # Item bir 'a' tagi ise doğrudan href al
                    if item.tag_name == 'a':
                        link = item.get_attribute("href")
                    else:
                        # Değilse içinde ara
                        link_elem = item.find_element(By.TAG_NAME, "a") # Daha genel
                        link = link_elem.get_attribute("href")
                else:
                    link_elem = item.find_element(By.CSS_SELECTOR, active_strategy["link"])
                    link = link_elem.get_attribute("href")
                
                if not link or not link.startswith("http"):
                    continue

                # Metni bul
                raw_text = ""
                if active_strategy["text_loc"]:
                    try:
                        raw_text = item.find_element(By.CSS_SELECTOR, active_strategy["text_loc"]).text.strip()
                    except:
                        raw_text = item.text.strip()
                else:
                    raw_text = item.text.strip()
                    if not raw_text:
                        raw_text = link_elem.get_attribute("textContent").strip()

                # Bölüm numarasını çıkar (Regex ile)
                match = re.search(r"(\d+(\.\d+)?)", raw_text)
                if match:
                    chapter_num = float(match.group(1))
                    chapter_links.append({"num": chapter_num, "url": link})
                    
            except Exception as e:
                # print(f"Hata: {e}")
                continue

        return chapter_links

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

            # 1. YÖNTEM: Requests (Hızlı)
            print("⚡ İçerik çekiliyor (Mod: Requests)...")
            content_found = False
            title_text = f"Bölüm {chapter_num}"
            text_content = ""

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://google.com',
                'X-Requested-With': 'XMLHttpRequest'
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
                    response = requests.get(chapter_url, headers=headers, timeout=10)
                
                    # Cloudflare veya Koruma kontrolü (403/503)
                    if response.status_code in [403, 503]:
                        print(f"⚠️ Requests engellendi ({response.status_code}). Selenium'a geçiliyor...")
                        raise Exception("Korumalı Site")
                    
                    if response.status_code == 404:
                        print(f"⚠️ Bölüm {chapter_num} bulunamadı (404)")
                        return
                    
                    if response.status_code == 200:
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
                                
                                if len(text_content) > 100: # 100 karakterden kısaysa muhtemelen "Loading..." veya hata mesajıdır
                                    content_found = True
                                    print(f"✅ İçerik requests ile çekildi! ({len(text_content)} karakter)")
                                else:
                                    print("⚠️ İçerik çok kısa, Selenium deneniyor...")

            except Exception as e:
                print(f"⚠️ Requests başarısız: {e}")
                # Hata durumunda Selenium'a devam et

            # 2. YÖNTEM: Selenium (Yavaş ama Güçlü - Fallback)
            if not content_found:
                print("🐢 Selenium Moduna Geçiliyor (Cloudflare/JS Handling)...")
                try:
                    self.driver.get(chapter_url)
                    
                    # İçeriğin yüklenmesini bekle (JS render için)
                    print("⏳ Yükleniyor (20sn)...")
                    time.sleep(20) 
                    
                    # Olası içerik selectorları (CSS Selector formatı)
                    selectors = [
                        ".m-read .txt",          # LightNovelPub (Specific)
                        ".chapter-text",         # Novelight
                        ".txt",                  # Generic
                        "#chapter-container",
                        ".entry-content",
                        ".cha-content",
                        ".chapter-content",
                        "#chapter-content",
                        "#chr-content"
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
                    
                    if found_element:
                        # Metni JS ile almayı dene (Gizli elementleri ayıklamak için innerText bazen daha temizdir)
                        text_content = self.driver.execute_script("return arguments[0].innerText;", found_element)
                        
                        # Başlığı da Selenium ile al
                        try:
                            title_elem = self.driver.find_element(By.TAG_NAME, "h1")
                            title_text = title_elem.text.strip()
                        except:
                            pass
                            
                        if len(text_content) > 50:
                            content_found = True
                            print(f"✅ İçerik Selenium ile çekildi! ({len(text_content)} karakter)")
                    else:
                        print("❌ Selenium da içerik bulamadı!")

                except Exception as sel_e:
                    print(f"❌ Selenium hatası: {sel_e}")

            # Sonuç Kontrolü ve Kayıt
            if content_found and text_content:
                self.translate_and_upload(novel, chapter_num, title_text, text_content)
            else:
                print(f"❌ Başarısız: Bölüm {chapter_num} içeriği hiçbir yöntemle alınamadı.")

        except Exception as e:
            print(f"❌ Bölüm işleme genel hatası: {e}")

    def translate_and_upload(self, novel, chapter_num, eng_title, eng_text):
        """
        Gemini ile çevir ve DB'ye kaydet
        """
        print(f"🤖 AI Çeviriyor: {eng_title}...")

        novel_title = novel.get('title', 'default')
        selected_glossary = NOVEL_CONFIGS.get("default")
        
        # Romana özel sözlük var mı?
        for key in NOVEL_CONFIGS:
            if key.lower() in novel_title.lower():
                selected_glossary = NOVEL_CONFIGS[key]
                print(f"📖 '{key}' sözlüğü aktif.")
                break
                
        system_instruction = f"""
Sen, profesyonel bir fantastik roman çevirmenisin.

GÖREVİN:
Aşağıdaki İngilizce roman bölümünü, Türk okuyucusu için akıcı, epik ve edebi bir dille Türkçeye çevirmek.

ÇEVİRİ KURALLARI:
1. **Ton:** Romanın türüne uygun (Karanlık, Epik, Eğlenceli vb.) bir ton kullan.
2. **Format:** Orijinal metindeki satır boşluklarını koru.
3. **ÖZEL TERİMLER:** {selected_glossary}

METİN:
{eng_text}
"""

        # Tek seferde çevir (RPM=5 olduğu için chunk yerine 1 istek daha iyi)
        max_retries = len(GOOGLE_API_KEYS)
        ceviri = eng_text  # Varsayılan: İngilizce (fallback)
        
        for attempt in range(max_retries):
            try:
                print(f"🔑 Key #{_current_key_index + 1} ile çeviriliyor...")
                active_client = get_gemini_client()
                response = active_client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=system_instruction
                )
                ceviri = response.text.strip()
                print(f"✅ Çeviri başarılı! ({len(ceviri)} karakter)")
                break
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    print(f"⚠️ Key #{_current_key_index + 1} kota aşıldı. Sonraki key'e geçiliyor...")
                    rotate_key()
                    if attempt == max_retries - 1:
                        print("❌ Tüm key'ler kota aşıldı! İngilizce olarak kaydediliyor.")
                else:
                    print(f"❌ Çeviri hatası: {e}")
                    break

        
        try:
            # ceviri, translate_chunk tarafından zaten set edildi
            # Temizlik: Gemini bazen açıklama ekler
            if "İşte çeviriniz" in ceviri or "Çeviri:" in ceviri:
                ceviri = ceviri.replace("İşte çeviriniz:", "").replace("Çeviri:", "").strip()
            
            # DB'ye kaydet (ON CONFLICT: aynı bölüm varsa sessizce atla)
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
                else:
                    print(f"⏩ Bölüm {chapter_num} zaten mevcut, atlandı.")
                
        except Exception as e:
            print(f"❌ Çeviri/Yükleme Hatası: {e}")

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
            txt_path = os.path.join(BACKEND_DIR, "novelseriler.txt")
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