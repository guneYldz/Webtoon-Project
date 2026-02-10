import os
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

# ==========================================
# ⚙️ AYARLAR
# ==========================================

# Botun çalıştığı klasör
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# Bir üst klasör (Backend)
BACKEND_DIR = os.path.dirname(CURRENT_DIR)

# .env dosyasını yükle (API Key vb. için lazım ama DB için aşağıdakini kullanacağız)
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

# 🔥 KRİTİK AYAR: Docker PostgreSQL Bağlantısı (DIŞARIDAN ERİŞİM)
# .env dosyasında ne yazarsa yazsın, bot Windows'ta olduğu için 5433 portunu kullanmalı.
DB_CONNECTION = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"

# Resimlerin kaydedileceği yer (Docker burayı görüyor)
BASE_PATH = os.path.join(BACKEND_DIR, "static")
print(f"📁 Resimler şuraya kaydedilecek: {BASE_PATH}")

SERI_DOSYASI = "seriler.txt"
SERI_ARASI_BEKLEME = 5
TUR_ARASI_BEKLEME = 1800

# PostgreSQL için motor oluşturuluyor
engine = create_engine(DB_CONNECTION)

# ==========================================
# 🖼️ RESİM İŞLEME
# ==========================================
def process_and_save_image(img_url, folder_path, file_name):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(img_url, headers=headers, stream=True, timeout=10)
        
        if response.status_code == 200:
            if len(response.content) < 1000:
                return None

            try:
                image = Image.open(BytesIO(response.content))
                image.verify()
                image = Image.open(BytesIO(response.content))
            except:
                return None

            if not os.path.exists(folder_path): os.makedirs(folder_path)
            full_path = os.path.join(folder_path, file_name)
            
            if image.mode in ("RGBA", "P"): image = image.convert("RGB")
            
            image.save(full_path, "WEBP", quality=80)
            print(f"      ✅ Kaydedildi: {file_name}")
            
            # 🔥 DÜZELTME: Mutlak yol yerine "static/..." formatında göreceli yol döndür
            # full_path: C:/Users/.../Backend/static/covers/file.webp
            # BACKEND_DIR: C:/Users/.../Backend
            relative_path = os.path.relpath(full_path, BACKEND_DIR)
            return relative_path.replace("\\", "/")
            
    except Exception as e:
        if "cannot identify" not in str(e):
            print(f"      ❌ Resim hatası: {e}")
        return None

# ==========================================
# 🤖 AKILLI BOT SINIFI
# ==========================================
class AutoBot:
    def __init__(self):
        options = uc.ChromeOptions()
        options.add_argument("--start-maximized")
        # options.add_argument("--headless") # İstersen açabilirsin
        self.driver = uc.Chrome(options=options, version_main=144)

    def check_single_series(self, target_url):
        print(f"\n🕵️ [{time.strftime('%H:%M:%S')}] Kontrol ediliyor: {target_url}")
        
        try:
            self.driver.get(target_url)
            time.sleep(5)

            # --- SERİ BİLGİLERİNİ AL ---
            try:
                try: title = self.driver.find_element(By.TAG_NAME, "h1").text.strip()
                except: title = self.driver.find_element(By.CSS_SELECTOR, ".post-title h1").text.strip()
                
                slug = slugify(title)
                
                cover_src = None
                cover_selectors = [".summary_image img", ".c-image-hover img", ".wp-post-image", ".thumb img"]
                for sel in cover_selectors:
                    try:
                        c = self.driver.find_element(By.CSS_SELECTOR, sel)
                        cover_src = c.get_attribute("src")
                        if cover_src: break
                    except: continue

                webtoon_id = self.sync_webtoon_info(title, slug, cover_src)
                
                # --- BÖLÜM LİSTESİ ---
                site_chapters = []
                selector_strategies = [
                    {"container": ".chapter-item", "link": "a.uk-link-toggle", "text_loc": "h3"},
                    {"container": "#chapterlist li", "link": "a", "text_loc": ".chapternum"},
                    {"container": "#chapterlist li", "link": "a", "text_loc": ""},
                    {"container": "li.wp-manga-chapter", "link": "a", "text_loc": ""}
                ]

                found_items = []
                active_strategy = None

                for strategy in selector_strategies:
                    items = self.driver.find_elements(By.CSS_SELECTOR, strategy["container"])
                    if items:
                        found_items = items
                        active_strategy = strategy
                        print(f"   🔧 Site Yapısı: {strategy['container']} ({len(items)} Bölüm)")
                        break
                
                if not found_items:
                    print("   ⚠️ HATA: Bölüm listesi bulunamadı!")
                    return

                print("   ... Bölümler taranıyor ...")
                for item in found_items:
                    try:
                        link_elem = item.find_element(By.CSS_SELECTOR, active_strategy["link"])
                        link = link_elem.get_attribute("href")
                        
                        raw_text = ""
                        if active_strategy["text_loc"]:
                            try: raw_text = item.find_element(By.CSS_SELECTOR, active_strategy["text_loc"]).text.strip()
                            except: raw_text = item.text.strip()
                        else:
                            raw_text = item.text.strip()
                            if not raw_text: raw_text = link_elem.get_attribute("textContent").strip()

                        import re
                        match = re.search(r"(\d+(\.\d+)?)", raw_text)
                        if match:
                            site_chapters.append({"num": match.group(1), "url": link})
                    except: continue

                existing_chapters = self.get_db_chapters(webtoon_id)
                new_chapters = [ch for ch in site_chapters if ch["num"] not in existing_chapters]

                if not new_chapters:
                    print(f"   ✅ Durum: GÜNCEL. ({len(site_chapters)} bölüm var)")
                else:
                    print(f"   🚀 {len(new_chapters)} YENİ BÖLÜM YAKALANDI!")
                    for chap in reversed(new_chapters):
                        print(f"\n   ⬇️ İndiriliyor: Bölüm {chap['num']}")
                        self.download_chapter(chap["url"], webtoon_id, chap["num"], slug)

            except Exception as inner_e:
                print(f"   ❌ Seri okunurken hata: {inner_e}")

        except Exception as e:
            print(f"❌ Sayfa yükleme hatası: {e}")

    def sync_webtoon_info(self, title, slug, cover_url):
        cover_path = ""
        with engine.connect() as conn:
            row = conn.execute(text("SELECT id FROM webtoons WHERE slug = :slug"), {"slug": slug}).fetchone()
            if row: return row[0]
            else:
                if cover_url:
                    cover_path = process_and_save_image(cover_url, os.path.join(BASE_PATH, "covers"), f"{slug}-cover.webp")
                
                # 🔥 DÜZELTME: GETDATE() -> NOW() ve is_published=TRUE
                ins = text("""
                    INSERT INTO webtoons (title, slug, summary, cover_image, status, type, view_count, is_featured, is_published, created_at) 
                    VALUES (:t, :s, :sum, :c, 'ongoing', 'MANGA', 0, FALSE, TRUE, NOW())
                    RETURNING id
                """)
                # Postgres'te RETURNING id ile ID'yi geri alırız
                result = conn.execute(ins, {"t": title, "s": slug, "sum": f"{title} özeti", "c": cover_path})
                new_id = result.fetchone()[0]
                conn.commit()
                return new_id

    def get_db_chapters(self, webtoon_id):
        with engine.connect() as conn:
            result = conn.execute(text("SELECT episode_number FROM webtoon_episodes WHERE webtoon_id = :wid"), {"wid": webtoon_id}).fetchall()
        return [str(int(row[0])) if row[0] % 1 == 0 else str(row[0]) for row in result]

    def download_chapter(self, url, webtoon_id, chap_num, series_slug):
        try:
            self.driver.get(url)
            print("      ⏳ Sayfa yükleniyor, #readerarea bekleniyor...")
            try:
                WebDriverWait(self.driver, 20).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "#readerarea img"))
                )
            except:
                print("      ⚠️ #readerarea zaman aşımına uğradı! Alternatifler deneniyor...")

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

            if image_urls and len(image_urls) > 0:
                print(f"      🎯 {len(image_urls)} resim bulundu! İndiriliyor...")
                
                with engine.connect() as conn:
                    check = conn.execute(text("SELECT id FROM webtoon_episodes WHERE webtoon_id=:w AND episode_number=:e"), {"w":webtoon_id, "e":chap_num}).fetchone()
                    if not check:
                        # 🔥 DÜZELTME: GETDATE() -> NOW() ve is_published=TRUE (Bölüm de yayınlansın)
                        conn.execute(text("""
                            INSERT INTO webtoon_episodes (webtoon_id, episode_number, title, view_count, is_published, created_at) 
                            VALUES (:w, :e, :t, 0, TRUE, NOW())
                        """), {"w": webtoon_id, "e": chap_num, "t": f"Bölüm {chap_num}"})
                        conn.commit()

                episode_folder = os.path.join(BASE_PATH, "images", series_slug, f"bolum-{chap_num}")
                
                count = 0
                for idx, src in enumerate(image_urls):
                    fname = f"{series_slug}-bolum-{chap_num}-sahne-{idx+1}.webp"
                    if process_and_save_image(src, episode_folder, fname):
                        count += 1
                
                if count == 0: 
                    print("      ⚠️ Linkler bulundu ama indirilemedi.")
            else:
                print("      ⚠️ RESİM HALA BULUNAMADI!")

        except Exception as e:
            print(f"      ❌ İndirme hatası: {e}")

# ==========================================
# 🚀 ANA ÇALIŞTIRMA BLOĞU
# ==========================================
def main():
    if not os.path.exists(SERI_DOSYASI):
        with open(SERI_DOSYASI, "w", encoding="utf-8") as f: f.write("")
        return

    bot = AutoBot()
    print("🤖 OTO-PİLOT BAŞLATILDI (POSTGRESQL VERSİYONU)!")

    while True:
        with open(SERI_DOSYASI, "r", encoding="utf-8") as f:
            urls = [line.strip() for line in f if line.strip()]
        
        if not urls:
            time.sleep(60)
            continue

        for url in urls:
            bot.check_single_series(url)
            time.sleep(SERI_ARASI_BEKLEME) 

        time.sleep(TUR_ARASI_BEKLEME)

if __name__ == "__main__":
    main()