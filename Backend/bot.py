import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
import time
import os  # EKLENDİ: İşletim sistemi komutları için
from dotenv import load_dotenv  # EKLENDİ: .env dosyasını okumak için

# ==========================================
# ⚙️ AYARLAR
# ==========================================

# 1. Gizli dosyayı (.env) yükle
load_dotenv()

# 2. Şifreyi o dosyadan çek (Burası değişti!)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") 

API_URL = "http://127.0.0.1:8000"
TEST_SOURCE_URL = "https://topnovelhub.com/shadow-slave-chapter-1/"
TARGET_SERIES_ID = 1

# 3. Kontrol Et
if not GOOGLE_API_KEY:
    print("❌ HATA: API Anahtarı bulunamadı! Lütfen .env dosyasını oluşturduğundan emin ol.")
    exit() # Anahtar yoksa programı durdur
else:
    print("✅ Güvenlik: API Anahtarı başarıyla yüklendi.")

# Gemini'yi Yapılandır
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('models/gemini-flash-latest')

# ==========================================
# 1. MODÜL: VERİ ÇEKME (SCRAPER)
# ==========================================
def scrape_chapter(url):
    print(f"🌍 Siteye gidiliyor: {url}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            print(f"❌ Hata: Siteye erişilemedi. Kod: {response.status_code}")
            return None, None

        soup = BeautifulSoup(response.text, 'html.parser')

        # Başlık Bulma
        title_tag = soup.find('h1')
        title_text = title_tag.get_text(strip=True) if title_tag else "Baslik Bulunamadi"

        # İçerik Bulma (Burası siteye göre değişebilir)
        content = soup.find('div', class_='entry-content')
        if not content: content = soup.find('div', class_='cha-content')
        if not content: content = soup.find('div', class_='reading-content')

        if content:
            # Gereksizleri temizle
            for bad_div in content.find_all(['div', 'script', 'style']):
                bad_div.decompose()

            # Metni al
            text_content = content.get_text(separator="\n\n")
            print(f"✅ Veri çekildi. Başlık: {title_text} | Uzunluk: {len(text_content)} karakter")
            
            return title_text, text_content
        else:
            print("❌ İçerik alanı bulunamadı.")
            return None, None

    except Exception as e:
        print(f"❌ Scraping Hatası: {e}")
        return None, None

# ==========================================
# 2. MODÜL: ÇEVİRİ (AI TRANSLATOR)
# ==========================================
def translate_text(title, text):
    print("🤖 Yapay Zeka çeviriyor... (Bu biraz sürebilir)")
    
    prompt = f"""
    Sen profesyonel bir roman çevirmenisin. Aşağıdaki İngilizce Web Novel bölümünü Türkçeye çevir.
    
    Kurallar:
    1. Romanın atmosferine uygun, akıcı ve edebi bir dil kullan.
    2. Özel isimleri (Sunny, Nephis vb.) değiştirme.
    3. Terimleri (Nightmare Spell -> Kâbus Büyüsü, Awakened -> Uyanmış) tutarlı çevir.
    4. Asla özet çıkarma, tam metni çevir.
    5. Cevap formatı:
       İlk satıra [TR Başlık]
       Altına [TR Metin]
    
    Orijinal Başlık: {title}
    Orijinal Metin:
    {text}
    """
    
    try:
        generation_config = genai.types.GenerationConfig(
            max_output_tokens=8192, 
            temperature=0.7,
        )

        response = model.generate_content(prompt, generation_config=generation_config)
        translated_text = response.text
        
        lines = translated_text.split('\n')
        tr_title = lines[0].replace("Başlık:", "").replace("Title:", "").strip()
        tr_text = "\n".join(lines[1:]).strip()
        
        print(f"✅ Çeviri tamamlandı. Karakter: {len(tr_text)}")
        return tr_title, tr_text

    except Exception as e:
        print(f"❌ AI Hatası: {e}")
        return title, text 

# ==========================================
# 3. MODÜL: YÜKLEME (UPLOADER)
# ==========================================
def upload_chapter(webtoon_id, title, episode_num, content):
    print("🚀 Veritabanına yükleniyor...")
    
    payload = {
        "webtoon_id": webtoon_id,
        "title": title,
        "episode_number": episode_num,
        "content_text": content 
    }
    
    endpoint = f"{API_URL}/episodes/" 
    
    try:
        response = requests.post(endpoint, json=payload)
        
        if response.status_code in [200, 201]:
            print(f"🎉 BAŞARILI! Bölüm yüklendi. ID: {response.json().get('id')}")
        else:
            print(f"❌ Yükleme Başarısız: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Bağlantı Hatası: {e}")

# ==========================================
# ANA ÇALIŞMA BLOĞU
# ==========================================
if __name__ == "__main__":
    
    # 1. ADIM: Veriyi Çek
    eng_title, eng_text = scrape_chapter(TEST_SOURCE_URL)
    
    # 2. ADIM: Çeviri Yap ve Yükle
    if eng_title and eng_text:
        tr_title, tr_text = translate_text(eng_title, eng_text)
        
        if tr_text:
            upload_chapter(
                webtoon_id=TARGET_SERIES_ID, 
                title=tr_title, 
                episode_num=1, 
                content=tr_text
            )