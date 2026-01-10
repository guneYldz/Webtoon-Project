import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
import time
import os
from dotenv import load_dotenv
import cloudscraper

# ==========================================
# ⚙️ AYARLAR
# ==========================================
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
API_URL = "http://127.0.0.1:8000"

BOT_USERNAME = os.getenv("BOT_USERNAME", "bot123@gmail.com") 
BOT_PASSWORD = os.getenv("BOT_PASSWORD", "622662") 
BEKLEME_SURESI = 10 

if not GOOGLE_API_KEY:
    print("❌ HATA: API Anahtarı bulunamadı! .env dosyasını kontrol et.")
    exit()

genai.configure(api_key=GOOGLE_API_KEY)
# Senin hesabındaki en iyi model
model = genai.GenerativeModel('gemini-2.5-flash')

# ==========================================
# 📚 ROMANLARA ÖZEL SÖZLÜKLER (CONFIG)
# ==========================================
# Buraya yeni seri ekledikçe kurallarını yazabilirsin.
# "default": Tanımlanmamış romanlar için genel kurallar.
NOVEL_CONFIGS = {
    "Shadow Slave": """
        1. "Nightmare Spell" -> "Kabus Büyüsü"
        2. "First Trial" -> "İlk Sınav"
        3. "Aspirant" -> "Aday"
        4. "Awakened" -> "Uyanmış"
        5. "Sleeper" -> "Uyuyan"
        6. "Sunny" -> "Sunny", "Nephis" -> "Nephis" (Özel isimler değişmez)
        7. "Legacy" -> "Miras"
        8. "Aspect" -> "Veçhe"
        9. "Memory" -> "Anı"
        10. "Echo" -> "Yankı"
    """,
    

    "default": """
        1. Özel isimleri (Karakter adları, şehir adları) ASLA çevirme.
        2. Büyü isimlerini mümkünse Türkçe karşılığıyla, parantez içinde İngilizcesi olacak şekilde çevir.
        3. Ton: Edebi, akıcı ve romanın türüne uygun (Fantastik ise epik, Romantik ise duygusal).
    """
}

# ==========================================
# 🔑 GİRİŞ
# ==========================================
def get_auth_token():
    try:
        response = requests.post(
            f"{API_URL}/auth/giris-yap",
            data={"username": BOT_USERNAME, "password": BOT_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        
        print(f"❌ Giriş Başarısız! Kod: {response.status_code} - {response.text}")
        return None
    except Exception as e:
        print(f"❌ Login Hatası: {e}")
        return None

# ==========================================
# 🔍 EN SON BÖLÜMÜ ÖĞREN
# ==========================================
def get_last_chapter_number(token, novel_id, novel_slug):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        # ID ile kontrol
        response = requests.get(f"{API_URL}/novels/{novel_id}", headers=headers)
        if response.status_code == 200:
            data = response.json()
            chapters = data.get("chapters", [])
            if chapters:
                return max([ch["chapter_number"] for ch in chapters])
        
        # Slug ile kontrol (Yedek)
        response = requests.get(f"{API_URL}/novels/{novel_slug}", headers=headers)
        if response.status_code == 200:
            data = response.json()
            chapters = data.get("chapters", [])
            if chapters:
                return max([ch["chapter_number"] for ch in chapters])

        return 0 
    except:
        return 0

# ==========================================
# 📚 ROMAN LİSTESİ
# ==========================================
def get_all_novels(token):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(f"{API_URL}/novels/", headers=headers) 
        if response.status_code == 200:
            return response.json() 
        print(f"⚠️ Roman listesi çekilemedi. Kod: {response.status_code}")
        return []
    except Exception as e:
        print(f"❌ Liste Hatası: {e}")
        return []

# ==========================================
# 🕷️ SCRAPER
# ==========================================
def scrape_chapter(url):
    print(f"   🌍 Kaynak taranıyor: {url}")
    scraper = cloudscraper.create_scraper() 
    try:
        response = scraper.get(url)
        if response.status_code == 404:
            if url.endswith("/"):
                response = scraper.get(url[:-1])
            if response.status_code == 404:
                print("   info: Bu bölüm gerçekten yok (404).")
                return None, None
                
        if response.status_code != 200:
            print(f"   ⚠️ HATA: Site cevap vermedi. Kod: {response.status_code}")
            return None, None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        title_tag = soup.find('h1') or soup.find('h2')
        title_text = title_tag.get_text(strip=True) if title_tag else f"Bölüm"

        content = soup.find('div', class_='entry-content') or \
                  soup.find('div', class_='cha-content') or \
                  soup.find('div', class_='reading-content') or \
                  soup.find('div', class_='chapter-content') or \
                  soup.find('div', id='chapter-content') or \
                  soup.find('div', class_='text-left')

        if content:
            for bad in content.find_all(['script', 'style', 'div', 'a', 'iframe', 'p.display-hide']):
                bad.decompose()
            text_content = content.get_text(separator="\n\n").strip()
            if len(text_content) < 50:
                print("   ⚠️ İçerik çok kısa.")
                return None, None
            print(f"   ✅ Veri çekildi! ({len(text_content)} karakter)")
            return title_text, text_content
        
        print("   ❌ İçerik bulunamadı.")
        return None, None
    except Exception as e:
        print(f"   ❌ Scraping Hatası: {e}")
        return None, None

# ==========================================
# 🤖 ÇEVİRİ VE YÜKLEME (AKILLI SÖZLÜK SİSTEMİ)
# ==========================================
def translate_and_upload(token, novel, chapter_num, eng_title, eng_text):
    print(f"   🤖 AI Çeviriyor: {eng_title}...")

    # 1. Romanın ismine göre doğru sözlüğü seç
    novel_title = novel.get('title', 'default')
    
    # Eğer listede varsa onu kullan, yoksa 'default' kullan
    # (Büyük/küçük harf duyarsız yapmak için basit bir kontrol)
    selected_glossary = NOVEL_CONFIGS.get("default")
    
    for key in NOVEL_CONFIGS:
        if key.lower() in novel_title.lower():
            selected_glossary = NOVEL_CONFIGS[key]
            print(f"   📖 '{key}' için özel sözlük yüklendi.")
            break
            
    system_instruction = f"""
    Sen, dünyaca ünlü web romanlarını Türkçeye kazandıran profesyonel bir edebiyat çevirmenisin.
    
    GÖREVİN:
    Aşağıdaki İngilizce roman bölümünü, Türk okuyucusu için akıcı, epik ve edebi bir dille Türkçeye çevirmek.
    
    ÇEVİRİ KURALLARI:
    1. **Ton:** Romanın türüne uygun (Karanlık, Epik, Eğlenceli vb.) bir ton kullan.
    2. **Sistem Mesajları:** Köşeli parantez `[...]` içindeki metinler "Oyun Sistemi" mesajlarıdır. Bunları resmi, soğuk ve ilahi bir tonda çevir.
    3. **Format:** Orijinal metindeki satır boşluklarını ve paragraf yapısını koru.
    4. **ÖZEL TERİMLER (BU ROMAN İÇİN):** Aşağıdaki kurallara KESİNLİKLE uy:
    {selected_glossary}
    
    METİN:
    {eng_text}
    """

    try:
        response = model.generate_content(system_instruction)
        ceviri = response.text
        if "İşte çeviriniz" in ceviri or "Çeviri:" in ceviri:
            ceviri = ceviri.replace("İşte çeviriniz:", "").replace("Çeviri:", "").strip()
        
        payload = {
            "novel_id": novel['id'],
            "chapter_number": chapter_num,
            "title": eng_title, 
            "content": ceviri
        }
        headers = {"Authorization": f"Bearer {token}"}
        
        print("   📤 Bölüm yükleniyor...")
        res = requests.post(f"{API_URL}/novels/bolum-ekle", data=payload, headers=headers)
        
        if res.status_code == 422: # Yedek
             res = requests.post(f"{API_URL}/novels/bolum-ekle", json=payload, headers=headers)
        
        if res.status_code == 404: # Yedek Rota
            res = requests.post(f"{API_URL}/novels/chapters/", data=payload, headers=headers)

        if res.status_code in [200, 201]:
            print(f"   🎉 Bölüm {chapter_num} BAŞARIYLA KAYDEDİLDİ!")
            return "SUCCESS"
        
        elif res.status_code == 400 and "mevcut" in res.text:
            print(f"   ⏩ Bölüm {chapter_num} zaten var. Atlanıyor...")
            return "SKIP"
            
        else:
            print(f"   ❌ Kayıt Hatası: {res.status_code} - {res.text}")
            return "ERROR"
            
    except Exception as e:
        print(f"   ❌ Hata: {e}")
        return "ERROR"

# ==========================================
# 🏭 FABRİKA MODU
# ==========================================
if __name__ == "__main__":
    
    print("🏭 ROMAN FABRİKASI BAŞLATILDI")
    print("Bot, kaldığı yerden devam edecek.\n")

    while True:
        token = get_auth_token()
        
        if token:
            all_novels = get_all_novels(token)
            active_novels = [n for n in all_novels if n.get('source_url')]
            
            print(f"📋 Kontrol edilecek roman sayısı: {len(active_novels)}")

            for novel in active_novels:
                print(f"\n🔹 SERİ: {novel['title']}")
                
                last_ch = get_last_chapter_number(token, novel['id'], novel['slug'])
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
                    
                    status = translate_and_upload(token, novel, current_ch, eng_title, eng_text)
                    
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
            print("⚠️ Token alınamadı.")

        print(f"\n💤 Tur tamamlandı. Bot {BEKLEME_SURESI} saniye dinleniyor...")
        time.sleep(BEKLEME_SURESI)