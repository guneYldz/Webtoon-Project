import requests
from bs4 import BeautifulSoup
from google import genai
import time
import os
import itertools
from dotenv import load_dotenv
import cloudscraper
import re  # Bölüm başlığı regex için

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
        os.getenv("GOOGLE_API_KEY_4"),
        os.getenv("GOOGLE_API_KEY_5"),
        os.getenv("GOOGLE_API_KEY_6"),
        os.getenv("GOOGLE_API_KEY_7")

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

# LOCALHOST AYARI: Docker'ın dışarı açtığı porta bağlanıyoruz.
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
        if response.status_code == 200:
            print("✅ Giriş Başarılı! Token alındı.")
            return response.json().get("access_token")
        else:
            print(f"❌ Giriş Reddedildi! Kod: {response.status_code} | Hata: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Sunucuya Bağlanılamadı (Local API): {e}")
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
        if res.status_code == 200:
            return res.json()
        else:
            print(f"❌ Romanlar çekilemedi! Sunucu Kod: {res.status_code}")
            return []
    except Exception as e:
        print(f"❌ Roman API'sine bağlanırken hata: {e}")
        return []

# ==========================================
# 🕷️ SCRAPER
# ==========================================
# 🚨 HAYALET BÖLÜM (Ghost Chapter) Koruması
# Freewebnovel olmayan bölümlerde 404 vermek yerine sahte sayfa gösterebilir.
# Bu anahtar kelimelerden biri içerikteyse bölüm sahte demektir.
GHOST_CHAPTER_KEYWORDS = [
    "coming soon", "chapter not found", "this chapter is locked",
    "chapter is not available", "no chapter found", "page not found",
    "does not exist", "chapter coming soon", "will be released",
    "subscribe to read", "premium chapter", "locked chapter",
]
MIN_CHAPTER_LENGTH = 1500  # Gerçek bir roman bölümü en az ~300 kelime = ~1500 karakter

def scrape_chapter(url, current_ch_num): # Parametreye current_ch_num ekledik
    print(f"   🌍 Kaynak taranıyor: {url}")
    scraper = cloudscraper.create_scraper()
    try:
        # 🛡️ KORUMA 1: Yönlendirme (Redirect) Algılayıcı
        # allow_redirects=True (varsayılan) ile istek atıyoruz ama final URL'i kontrol ediyoruz
        response = scraper.get(url, timeout=10)
        if response.status_code != 200: return None, None

        # Final URL ile istenen URL'i karşılaştır
        final_url = response.url.rstrip('/')
        requested_url = url.rstrip('/')
        if final_url != requested_url:
            print(f"   🚨 HAYALET BÖLÜM TESPİT EDİLDİ! (Yönlendirme)")
            print(f"      İstenen : {requested_url}")
            print(f"      Gidilen  : {final_url}")
            print(f"   🛑 Bölüm {current_ch_num} yok. Seri tamamlandı kabul ediliyor.")
            return None, None

        soup = BeautifulSoup(response.text, 'html.parser')
        title_tag = soup.find('h1') or soup.find('span', class_='title__')

        content = soup.find('div', class_='txt') or soup.find('div', id='content')

        if content:
            for bad in content.find_all(['script', 'style', 'iframe', 'a']):
                bad.decompose()

            # --- BAŞLIK TEMİZLİĞİ BAŞLIYOR (Terminatör Radar) ---
            clean_title = f"Bölüm {current_ch_num}"  # Varsayılan halimiz

            # Sitenin başlık barındırabilecek TÜM etiketlerini acımadan tarıyoruz
            for tag in soup.find_all(['title', 'h1', 'h2', 'h3', 'h4', 'span', 'div']):
                text = tag.get_text(separator=" ", strip=True)

                # "Chapter 1 Nightmare Begins" veya "Chapter 1 - Nightmare Begins" formatını ara
                match = re.search(rf'Chapter\s*{re.escape(str(current_ch_num))}\s*[:-]?\s*(.+)', text, re.IGNORECASE)

                if match:
                    extra_name = match.group(1).strip()

                    # Reklam ve site adı kalıntılarını temizle
                    extra_name = re.sub(r'(?i)\s*online for free.*$', '', extra_name).strip()
                    extra_name = re.sub(r'(?i)\s*-?\s*freewebnovel.*$', '', extra_name).strip()
                    extra_name = re.sub(r'(?i)\s*-?\s*read online.*$', '', extra_name).strip()
                    extra_name = re.sub(r'(?i)\s*\|\s*.*$', '', extra_name).strip()  # "Title | SiteName" kalıpları

                    # Bulunan isim mantıklı bir uzunluktaysa (ne çok kısa, ne de destan gibi uzun)
                    if 1 < len(extra_name) < 80:
                        clean_title = f"Bölüm {current_ch_num} - {extra_name}"
                        print(f"   🎯 Başlık bulundu: '{clean_title}'")
                        break  # Hedefi vurduk, taramayı durdur!
            # --- BAŞLIK TEMİZLİĞİ BİTTİ ---

            raw_text = content.get_text(separator="\n\n").strip()

            # 🛡️ KORUMA 2: Minimum Karakter Sayısı Kontrolü
            if len(raw_text) < MIN_CHAPTER_LENGTH:
                print(f"   🚨 HAYALET BÖLÜM TESPİT EDİLDİ! (Çok Kısa İçerik)")
                print(f"      İçerik uzunluğu: {len(raw_text)} karakter (minimum: {MIN_CHAPTER_LENGTH})")
                print(f"      İçerik önizleme: '{raw_text[:200]}'")
                print(f"   🛑 Bölüm {current_ch_num} yok. Seri tamamlandı kabul ediliyor.")
                return None, None

            # 🛡️ KORUMA 3: Sahte İçerik Anahtar Kelime Filtresi
            raw_text_lower = raw_text.lower()
            for keyword in GHOST_CHAPTER_KEYWORDS:
                if keyword in raw_text_lower:
                    print(f"   🚨 HAYALET BÖLÜM TESPİT EDİLDİ! (Sahte İçerik Kelimesi: '{keyword}')")
                    print(f"   🛑 Bölüm {current_ch_num} yok. Seri tamamlandı kabul ediliyor.")
                    return None, None

            return clean_title, raw_text
        return None, None
    except Exception as e:
        print(f"   ❌ Scraping Hatası: {e}")
        return None, None
# ==========================================
# 🤖 ÇEVİRİ VE YÜKLEME
# ==========================================

# 🔧 İKİNCİ PAİL KONTROLÜ
# True = Her bölüm 2 API çağrısı harcar ama kalite artar
# False = Tek geçiş, daha hızlı
ENABLE_POLISH_PASS = True

def call_gemini(prompt_text, label=""):
    """
    Gemini'yi çağır. 429/rate limit üzerinde key rotasyonu uygular.
    Başarılıysa metin döndürür, tüm denemeler bişşerse None döndürür.
    """
    global client
    max_cycles = 3
    for cycle in range(max_cycles):
        for _ in range(len(GOOGLE_API_KEYS)):
            try:
                client = get_gemini_client()
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt_text
                )
                return response.text.strip()
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    print(f"⚠️ Rate limit ({label}) - Key #{_current_key_index + 1} doldu, sonraki key'e geçiliyor...")
                    rotate_key()
                else:
                    print(f"   ❌ API Hatası ({label}): {e}")
                    return None
        print(f"⏳ Tüm key'ler rate limit'e çarptı. 65sn bekleniyor... (Döngü {cycle+1}/{max_cycles})")
        time.sleep(65)
    print("❌ Tüm API denemeleri başarısız.")
    return None

def translate_and_upload(token, novel, chapter_num, eng_title, eng_text):
    global client

    if not client:
        print("❌ HATA: Gemini client başlatılamadı!")
        return "ERROR"

    novel_key = "default"
    if "Shadow Slave" in novel['title']: novel_key = "Shadow Slave"
    elif "Ghost Story" in novel['title']: novel_key = "Ghost Story"

    config = NOVEL_CONFIGS[novel_key]
    print(f"   🤖 AI ({novel_key}) Çeviriyor... (Key: {GOOGLE_API_KEYS[_current_key_index][:5]}...)")

    # ==================================================
    # 1. PAŞ: ANA ÇEVİRİ (Güçlendirilmiş Prompt)
    # ==================================================
    translation_prompt = f"""
    Sen usta bir roman çevirmenisin. Aşağıdaki İngilizce roman bölümünü Türkçeye çevir.

    TEMEL KURALLAR (KESİNLİKLE UYULMASI ZORUNLU):
    1. ASLA "Elbette", "İşte çeviri", "Tabii ki" gibi AI giriş cümleleri YAZMA.
    2. SADECE roman metnini döndür. Hiçbir açıklama, yorum veya not EKLEME.
    3. Paragraf düşmeşini KORU: Orijinaldeki her paragraf ayrı paragraf olarak kal.
    4. Kopuk veya yarım kalan cümle BİRAKMA. Her cümle kendi içinde tam ve anlamlı olsun.
    5. Listeler veya kısa fragment cümleler varsa bunları bir önceki veya sonraki cümleyle BIRLİŞTİR.
    6. "Ve...", "Ama...", "Ancak..." gibi bağlaçlarla başlayan kısa cümleleri önceki cümleye ekle.
    7. Bire bir sözcük tercemesi YAPMA; Anlamı, duyguyu ve romanın akışını Türkçeye taşı.

    ROMANİN TÜRÜNE ÖZEL TALIMATLAR:
    {config}

    ÇEVİRMENE ÖNEMLİ HATIRLATMA:
    - Okuyucu bu metni kitap okur gibi okuyacak. Her cümle akışkan, doğal ve Türkçe ırlığında hissettirmeli.
    - İngilizce cins romanlarını severçesine; söyleyeni, tonu ve karakterin his durumunu suya dütan göz kulak ol.

    ÇEVİRİLECEK METİN:
    {eng_text[:8000]}
    """

    ceviri = call_gemini(translation_prompt, label="Çeviri")
    if ceviri is None:
        print("❌ Çeviri başarısız. Bot 1 saat uyuyor...")
        time.sleep(3600)
        return "ERROR"

    # Giriş cümlesi temizliği (ekstra güvenlik)
    if ceviri.startswith(("İşte", "Elbette", "Çeviri:", "Tabii", "Metnin Çevirisi")):
        ceviri = "\n".join(ceviri.split("\n")[1:]).strip()

    # ==================================================
    # 2. PAŞ: TÜRKÇE AKICILIK DÜZENLEMESİ (isteğe bağlı)
    # ==================================================
    if ENABLE_POLISH_PASS:
        print(f"   ✨ Akıcılık düzenleniyor (2. paş)...")
        polish_prompt = f"""
        Aşağıdaki Türkçe roman çevirisini SADECE dil ve akış açısından iyileştir.
        Anlamı ASLA değiştirme. Paragraf sayısını KORUMA (Paragrafları silme veya birleştirme).

        DÜZELİTECEKLERİN:
        1. Kopuk, anlamsız veya yarım kalan cümleleri önceki veya sonraki cümleyle bütleştir.
        2. İngilizce yapıdan doğan kelime sırası bozukluklarını Türkçe’ye uygun hâle getir.
        3. Mekanik ve ruhsuz gelen ifadeleri doğal Türkçe söyleyiş biçimi ile yeniden yaz.
        4. "İlâv e edilen" gibi çeviri izleri bırakan ifadeleri sil veya doğallığa çevir.
        5. Çıktı SADECE temizlenmiş, düzeltilmiş metin olsun. Hiçbir açıklama ekleme.

        METİN:
        {ceviri[:8000]}
        """
        ceviri_polish = call_gemini(polish_prompt, label="Polish")
        if ceviri_polish:
            ceviri = ceviri_polish
            # Giriş cümlesi temizliği (polish sonrası da kontrol)
            if ceviri.startswith(("İşte", "Elbette", "Çeviri:", "Tabii", "Düzeltilmiş", "Aşağıda")):
                ceviri = "\n".join(ceviri.split("\n")[1:]).strip()
        else:
            print("   ⚠️ Polish pası başarısız, ham çeviri kullanılıyor.")

    # ==================================================
    # KAYDET
    # ==================================================
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

# ==========================================
# 🏭 ANA DÖNGÜ
# ==========================================
if __name__ == "__main__":
    print("🚀 KAOS BOT YEREL TEST MODU BAŞLATILDI")

    while True:
        token = get_auth_token()
        if token:
            novels = get_all_novels(token)
            print(f"📚 Veritabanından toplam {len(novels)} roman okundu.")

            KAOS_DOMAINS = ["freewebnovel.com"]
            active_novels = [
                n for n in novels
                if n.get('source_url') and any(d in n['source_url'] for d in KAOS_DOMAINS)
            ]
            print(f"🎯 Freewebnovel şartına uyan roman sayısı: {len(active_novels)}")

            if len(active_novels) == 0:
                print("⚠️ İşlem yapılacak uygun roman bulunamadı. Belki veritabanında 'source_url' kısmı boştur veya freewebnovel içermiyordur.")

            for novel in active_novels:
                print(f"\n🔹 KONTROL: {novel['title']}")
                last_ch = get_last_chapter_number(token, novel['id'], novel['slug'])
                current_ch = int(last_ch) + 1

                while True:
                    target_url = novel['source_url'].format(current_ch)
                    eng_title, eng_text = scrape_chapter(target_url, current_ch)

                    if not eng_text:
                        print(f"   ⚠️ {current_ch}. Bölüm bulunamadı veya çekilemedi, seriyi atlıyorum.")
                        break

                    status = translate_and_upload(token, novel, current_ch, eng_title, eng_text)
                    if status in ["SUCCESS", "SKIP"]:
                        current_ch += 1
                        time.sleep(5)
                    else: break

        print(f"\n💤 Bekleme modu ({BEKLEME_SURESI}sn)...")
        time.sleep(BEKLEME_SURESI)