import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
import time
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import cloudscraper

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

# 🔥 KRİTİK AYAR: Docker PostgreSQL Bağlantısı (DIŞARIDAN ERİŞİM)
# .env dosyasında ne yazarsa yazsın, bot Windows'ta olduğu için 5433 portunu kullanmalı.
DB_CONNECTION = "postgresql://webtoon_admin:gizlisifre123@localhost:5433/webtoon_db"

if not GOOGLE_API_KEY:
    print("❌ HATA: API Anahtarı bulunamadı! .env dosyasını kontrol et.")
    exit()

genai.configure(api_key=GOOGLE_API_KEY)
# Gemini 1.5 Flash (Zeki ve Hızlı)
model = genai.GenerativeModel('gemini-1.5-flash')

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
    """
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
# 🕷️ SCRAPER (HER SİTEYE UYUMLU MOD)
# ==========================================
def scrape_chapter(url):
    print(f"   🌍 Kaynak taranıyor: {url}")
    scraper = cloudscraper.create_scraper() 
    try:
        response = scraper.get(url)
        
        if response.status_code == 404:
            if not url.endswith("/"):
                response = scraper.get(url + "/")
            elif url.endswith("/"):
                response = scraper.get(url[:-1])
            
            if response.status_code == 404:
                print("   info: Bu bölüm gerçekten yok (404).")
                return None, None
                
        if response.status_code != 200:
            print(f"   ⚠️ HATA: Site cevap vermedi. Kod: {response.status_code}")
            return None, None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        title_tag = soup.find('h1') or soup.find('h2') or soup.find('h3', class_='title')
        title_text = title_tag.get_text(strip=True) if title_tag else f"Bölüm"

        content = soup.find('div', class_='entry-content') or \
                  soup.find('div', class_='cha-content') or \
                  soup.find('div', class_='reading-content') or \
                  soup.find('div', class_='chapter-content') or \
                  soup.find('div', id='chapter-content') or \
                  soup.find('div', id='chr-content') or \
                  soup.find('div', class_='text-left') or \
                  soup.find('article')

        if content:
            for bad in content.find_all(['script', 'style', 'div', 'a', 'iframe', 'p.display-hide', 'button']):
                bad.decompose()
            
            text_content = content.get_text(separator="\n\n").strip()
            
            if len(text_content) < 50:
                print("   ⚠️ İçerik çok kısa veya korumalı.")
                return None, None
                
            print(f"   ✅ Veri çekildi! ({len(text_content)} karakter)")
            return title_text, text_content
        
        print("   ❌ İçerik bulunamadı (HTML yapısı çok farklı).")
        return None, None
    except Exception as e:
        print(f"   ❌ Scraping Hatası: {e}")
        return None, None

# ==========================================
# 🤖 ÇEVİRİ VE YÜKLEME (DOĞRUDAN DB)
# ==========================================
def translate_and_upload(novel, chapter_num, eng_title, eng_text):
    print(f"   🤖 AI Çeviriyor: {eng_title}...")

    novel_title = novel.get('title', 'default')
    selected_glossary = NOVEL_CONFIGS.get("default")
    
    for key in NOVEL_CONFIGS:
        if key.lower() in novel_title.lower():
            selected_glossary = NOVEL_CONFIGS[key]
            print(f"   📖 '{key}' sözlüğü aktif.")
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

    try:
        response = model.generate_content(system_instruction)
        ceviri = response.text
        if "İşte çeviriniz" in ceviri or "Çeviri:" in ceviri:
            ceviri = ceviri.replace("İşte çeviriniz:", "").replace("Çeviri:", "").strip()
        
        with engine.connect() as conn:
            # Çift kontrol: Bölüm zaten var mı?
            check = conn.execute(
                text("SELECT id FROM novel_chapters WHERE novel_id = :nid AND chapter_number = :cnum"),
                {"nid": novel['id'], "cnum": chapter_num}
            ).fetchone()
            
            if check:
                print(f"   ⏩ Bölüm {chapter_num} zaten var. Atlanıyor...")
                return "SKIP"

            # 🔥 DÜZELTME: GETDATE() -> NOW() ve is_published=FALSE
            conn.execute(
                text("""
                    INSERT INTO novel_chapters (novel_id, chapter_number, title, content, view_count, is_published, created_at) 
                    VALUES (:nid, :cnum, :title, :content, 0, FALSE, NOW())
                """),
                {
                    "nid": novel['id'],
                    "cnum": chapter_num,
                    "title": eng_title,
                    "content": ceviri
                }
            )
            conn.commit()
            print(f"   🎉 Bölüm {chapter_num} BAŞARIYLA KAYDEDİLDİ!")
            return "SUCCESS"
            
    except Exception as e:
        print(f"   ❌ Çeviri/Yükleme Hatası: {e}")
        return "ERROR"

# ==========================================
# 🏭 FABRİKA MODU
# ==========================================
if __name__ == "__main__":
    
    print("🏭 ROMAN FABRİKASI BAŞLATILDI (POSTGRESQL VERSİYONU)")
    print("Bot, kaldığı yerden devam edecek.\n")

    while True:
        active_novels = get_active_novels()
        
        if active_novels:
            print(f"📋 Kontrol edilecek roman sayısı: {len(active_novels)}")

            for novel in active_novels:
                print(f"\n🔹 SERİ: {novel['title']}")
                
                last_ch = get_last_chapter_number(novel['id'])
                current_ch = last_ch + 1
                
                print(f"   ↪ Veritabanındaki Son Bölüm: {last_ch}")
                print(f"   🚀 Başlangıç Hedefi: {current_ch}")
                
                while True:
                    url_template = novel['source_url']
                    if "{}" not in url_template:
                        print("   ⚠️ Link formatı hatalı ({} yok).")
                        break

                    target_url = url_template.format(current_ch)
                    eng_title, eng_text = scrape_chapter(target_url)
                    
                    if not eng_text:
                        print(f"   🏁 Güncel. Başka bölüm yok.")
                        break 
                    
                    status = translate_and_upload(novel, current_ch, eng_title, eng_text)
                    
                    if status == "SUCCESS":
                        print("   ⏳ Diğer bölüme geçiliyor...")
                        current_ch += 1
                        time.sleep(5)
                    elif status == "SKIP":
                        print("   ⏩ Hızlı atlama yapılıyor...")
                        current_ch += 1
                        time.sleep(1) 
                    else:
                        print("   ⚠️ Kritik hata, bu roman atlanıyor.")
                        break
        else:
            print("⚠️ Aktif roman bulunamadı (source_url boş olabilir).")

        print(f"\n💤 Tur tamamlandı. Bot {BEKLEME_SURESI} saniye dinleniyor...")
        time.sleep(BEKLEME_SURESI)