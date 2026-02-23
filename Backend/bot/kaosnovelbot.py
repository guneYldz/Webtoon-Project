import requests
from bs4 import BeautifulSoup
from google import genai
import time
import os
import itertools
from dotenv import load_dotenv
import cloudscraper

# ==========================================
# ⚙️ AYARLAR VE YAPILANDIRMA
# ==========================================
load_dotenv()

# 4 API Key Rotasyonu
GOOGLE_API_KEYS = [
    k for k in [
        os.getenv("GOOGLE_API_KEY"),
        os.getenv("GOOGLE_API_KEY_2"),
        os.getenv("GOOGLE_API_KEY_3"),
        os.getenv("GOOGLE_API_KEY_4")
    ] if k
]

_current_key_index = 0

def get_gemini_client():
    return genai.Client(api_key=GOOGLE_API_KEYS[_current_key_index])

def rotate_key():
    global _current_key_index
    _current_key_index = (_current_key_index + 1) % len(GOOGLE_API_KEYS)
    print(f"🔄 API Key rotasyonu: Key #{_current_key_index + 1} aktif")

client = get_gemini_client() if GOOGLE_API_KEYS else None

# LOCALHOST AYARI: Kendi bilgisayarında test ettiğin için 8000 portunu kullanıyoruz.
API_URL = "http://127.0.0.1:8000" 

BOT_USERNAME = os.getenv("BOT_USERNAME", "gunyz.62@gmail.com") 
BOT_PASSWORD = os.getenv("BOT_PASSWORD", "62dersim62") 
BEKLEME_SURESI = 15 

# SERİYE ÖZEL AYARLAR (Config Yapısı)
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
# 🔑 YARDIMCI FONKSİYONLAR
# ==========================================
def get_auth_token():
    try:
        response = requests.post(f"{API_URL}/auth/giris-yap", data={"username": BOT_USERNAME, "password": BOT_PASSWORD})
        return response.json().get("access_token") if response.status_code == 200 else None
    except Exception as e:
        print(f"❌ Giriş Hatası (Local): {e}")
        return None

def get_last_chapter_number(token, novel_id, novel_slug):
    headers = {"Authorization": f"Bearer {token}"}
    for identifier in [novel_id, novel_slug]:
        try:
            res = requests.get(f"{API_URL}/novels/{identifier}", headers=headers)
            if res.status_code == 200:
                chapters = res.json().get("chapters", [])
                return max([ch["chapter_number"] for ch in chapters]) if chapters else 0
        except: continue
    return 0

def get_all_novels(token):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(f"{API_URL}/novels/", headers=headers)
        return res.json() if res.status_code == 200 else []
    except: return []

# ==========================================
# 🕷️ SCRAPER
# ==========================================
def scrape_chapter(url):
    print(f"   🌍 Kaynak taranıyor: {url}")
    scraper = cloudscraper.create_scraper() 
    try:
        response = scraper.get(url, timeout=10)
        if response.status_code != 200: return None, None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        title_tag = soup.find('h1') or soup.find('span', class_='title__')
        
        # Freewebnovel içerik kutusu
        content = soup.find('div', class_='txt') or \
                  soup.find('div', id='content')
        
        if content:
            for bad in content.find_all(['script', 'style', 'iframe', 'a']):
                bad.decompose()
            return title_tag.get_text(strip=True) if title_tag else "Bölüm", content.get_text(separator="\n\n").strip()
        return None, None
    except Exception as e:
        print(f"   ❌ Scraping Hatası: {e}")
        return None, None

# ==========================================
# 🤖 ÇEVİRİ VE YÜKLEME
# ==========================================
def translate_and_upload(token, novel, chapter_num, eng_title, eng_text):
    global client
    
    if not client:
        print("❌ HATA: Gemini client başlatılamadı!")
        return "ERROR"

    # Seriye özel konfigürasyon seçimi
    novel_key = "default"
    if "Shadow Slave" in novel['title']: novel_key = "Shadow Slave"
    elif "Ghost Story" in novel['title']: novel_key = "Ghost Story"
    
    config = NOVEL_CONFIGS[novel_key]

    print(f"   🤖 AI ({novel_key}) Çeviriyor... (Key: {GOOGLE_API_KEYS[_current_key_index][:5]}...)")

    prompt = f"""
    Sen profesyonel bir roman çevirmenisin. GÖREVİN: Aşağıdaki metni Türkçeye çevirmek.
    
    KURALLAR:
    1. ASLA 'Elbette', 'İşte çeviri' gibi giriş cümleleri yazma.
    2. SADECE romanın metnini döndür.
    3. Çeviride şu talimatları uygula:
{config}
    
    METİN:
    {eng_text[:8000]} 
    """

    max_cycles = 3  # Tüm keyler bittikten sonra max 3 kez bekle
    for cycle in range(max_cycles):
        for key_attempt in range(len(GOOGLE_API_KEYS)):
            try:
                client = get_gemini_client()
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt
                )
                ceviri = response.text.strip()
                
                # AI sohbet filtresi
                if ceviri.startswith(("Elbette", "İşte", "Çeviri:", "Tabii")):
                    ceviri = "\n".join(ceviri.split("\n")[1:])

                payload = {"novel_id": novel['id'], "chapter_number": chapter_num, "title": eng_title, "content": ceviri}
                headers = {"Authorization": f"Bearer {token}"}
                res = requests.post(f"{API_URL}/novels/bolum-ekle", data=payload, headers=headers)
                
                if res.status_code in [200, 201]:
                    print(f"   🎉 Bölüm {chapter_num} BAŞARIYLA KAYDEDİLDİ!")
                    return "SUCCESS"
                elif res.status_code == 400 and "mevcut" in res.text:
                    return "SKIP"
                else:
                    print(f"   ❌ Kayıt Hatası: {res.status_code} - {res.text}")
                    return "ERROR"

            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    print(f"⚠️ Rate limit (429) - Key #{_current_key_index + 1} doldu, sonraki key'e geçiliyor...")
                    rotate_key()
                else:
                    print(f"   ❌ API Hatası: {e}")
                    return "ERROR"

        # Tüm key'ler doldu — bir sonraki rpm penceresi için bekle
        wait_secs = 65
        print(f"⏳ Tüm key'ler ({len(GOOGLE_API_KEYS)}) rate limit'e çarptı. {wait_secs}sn bekleniyor... (Döngü {cycle+1}/{max_cycles})")
        time.sleep(wait_secs)

    print("❌ Tüm denemeler başarısız. İngilizce olarak kaydediliyor.")
    # Fallback: orijinal İngilizce metni kaydet
    payload = {"novel_id": novel['id'], "chapter_number": chapter_num, "title": eng_title, "content": eng_text}
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.post(f"{API_URL}/novels/bolum-ekle", data=payload, headers=headers)
    return "SUCCESS" if res.status_code in [200, 201] else "ERROR"

# ==========================================
# 🏭 ANA DÖNGÜ
# ==========================================
if __name__ == "__main__":
    print("🚀 KAOS BOT YEREL TEST MODU BAŞLATILDI")
    
    while True:
        token = get_auth_token()
        if token:
            novels = get_all_novels(token)
            # ⚠️ SADECE freewebnovel.com URL'leri işle
            # bot.py lightnovelpub/novellive URL'lerini yönetiyor,
            # kaosnovelbot sadece kendi domain'lerini alır → çakışma önlenir
            KAOS_DOMAINS = ["freewebnovel.com"]
            active_novels = [
                n for n in novels
                if n.get('source_url') and any(d in n['source_url'] for d in KAOS_DOMAINS)
            ]
            
            for novel in active_novels:
                print(f"\n🔹 KONTROL: {novel['title']}")
                last_ch = get_last_chapter_number(token, novel['id'], novel['slug'])
                current_ch = int(last_ch) + 1  # int'e çevir — float gelirse chapter-26.0 hatası oluşuyor
                
                while True:
                    # Link yapısı: .../chapter-{}
                    target_url = novel['source_url'].format(current_ch)
                    eng_title, eng_text = scrape_chapter(target_url)
                    
                    if not eng_text: break
                    
                    status = translate_and_upload(token, novel, current_ch, eng_title, eng_text)
                    if status in ["SUCCESS", "SKIP"]:
                        current_ch += 1
                        time.sleep(5)
                    else: break
        
        print(f"\n💤 Bekleme modu ({BEKLEME_SURESI}sn)...")
        time.sleep(BEKLEME_SURESI)