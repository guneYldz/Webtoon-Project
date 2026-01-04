from sqlalchemy import create_engine, text

# --- AYARLAR ---
# Senin SQL Server ismin
SERVER_NAME = r'.' 
DATABASE_NAME = 'WebtoonDB'

# Bağlantı Cümlesi
conn_str = f'mssql+pyodbc://@{SERVER_NAME}/{DATABASE_NAME}?driver=SQL+Server&trusted_connection=yes'

print(f"{SERVER_NAME} sunucusuna baglaniliyor...") # Türkçe karakter ve emoji yok

try:
    # 1. Motoru Çalıştır
    engine = create_engine(conn_str)
    
    # 2. Bağlantıyı Aç
    connection = engine.connect()
    print("BASARILI! Veritabanina sizdik!") # Emojisiz
    print("-" * 30)

    # 3. Verileri Çek
    result = connection.execute(text("SELECT title, view_count FROM webtoons"))

    # 4. Ekrana Yazdır
    for row in result:
        # Burada da emoji sildik
        print(f"Webtoon: {row.title} | Izlenme: {row.view_count}")

    connection.close()

except Exception as e:
    print("\nHATA! Baglanti kurulamadi.")
    print("Hata Detayi:", e)



    """ . Kütüphaneyi Çağırma (İthalat)
Python

from sqlalchemy import create_engine, text
sqlalchemy: Python'un veritabanlarıyla konuşmasını sağlayan en popüler kütüphanedir. Bir tercüman gibidir; Pythonca'yı SQL diline çevirir.

create_engine: Bu kütüphanenin "Motoru". Arabayı sürmeden önce motoru seçmek gibidir. Bağlantıyı yönetecek ana merkez.

text: Python, SQL kodlarını (SELECT * FROM...) sadece düz yazı zanneder. text fonksiyonu, "Hey Python, bu parantez içindeki yazı aslında bir SQL komutudur, ona göre davran" dememizi sağlar.

2. Adres Bilgileri (Ayarlar)
Python

SERVER_NAME = r'.\guney'  
DATABASE_NAME = 'WebtoonDB'
r harfi: (Raw String) Python'da \ işareti özel anlamlara gelir (mesela \n alt satıra geç demektir). Başına r koyarak Python'a şunu diyoruz: "İçerideki ters slajları komut sanma, ne görüyorsan onu düz yazı olarak al."

.\guney:

. (Nokta): "Localhost" yani "Bu Bilgisayar" demektir. Uzun uzun DESKTOP-9FF... yazmak yerine "Buradayım işte" demenin kısa yoludur.

\guney: Senin SQL Server'ının adı (Instance name).

WebtoonDB: Apartmanın (Server'ın) içindeki hangi daireye (Veritabanına) gireceğimizi belirtir.

3. Sihirli Cümle (Connection String) 🔑
Burası kodun en kritik yeri.

Python

conn_str = f'mssql+pyodbc://@{SERVER_NAME}/{DATABASE_NAME}?driver=SQL+Server&trusted_connection=yes'
Bu satır, Python'un elindeki Pasaporttur. İçinde şunlar yazar:

mssql: Gideceğimiz yer bir Microsoft SQL Server.

+pyodbc: Oraya giderken pyodbc adlı aracı (sürücüyü) kullanacağız.

@SERVER_NAME/DATABASE_NAME: Adres burası.

?driver=SQL+Server: Windows'un içindeki standart SQL sürücüsünü kullan.

trusted_connection=yes: "Bana şifre sorma! Ben zaten bu bilgisayarın sahibiyim (Windows kullanıcısıyım), beni tanı." (Windows Authentication).

4. Güvenlik Çemberi (Try - Except)
Python

try:
    # ... Kodlar ...
except Exception as e:
    # ... Hata Mesajı ...
Mantığı: "Dene (Try)". Eğer kod çalışırken patlarsa, programı çökertme; hatayı yakala (Except) ve bana sebebini söyle.

Veritabanı işleri risklidir (internet kopar, server kapalıdır vs.), o yüzden hep bu koruma kalkanı içinde yazılır.

5. Bağlantı ve İcraat ⚙️
Python

engine = create_engine(conn_str) # 1. Motoru hazırla
connection = engine.connect()    # 2. Kontağı çevir (Bağlan)
create_engine: Sadece ayarları hafızaya alır, henüz bağlanmaz.

connect(): İşte gerçek işlemin yapıldığı an budur. Kablo burada takılır. Hata alırsan genelde bu satırda alırsın.

Python

result = connection.execute(text("SELECT title FROM webtoons"))
execute (Çalıştır): SQL kodunu sunucuya fırlatır.

result (Sonuç): Sunucudan dönen cevap (tablo) bu değişkenin içine hapsolur. Şu an result içinde Solo Leveling verisi var.

6. Veriyi Paketten Çıkarma (Döngü)
Python

for row in result:
    print(f"Webtoon: {row.title}")
Veritabanından gelen veri bir "Liste" gibidir.

Python'a diyoruz ki: "Gelen sonuç listesindeki her bir satırı (row) tek tek eline al ve o satırın title (başlık) sütununu ekrana yaz."

7. Kapıyı Kapatma
Python

connection.close()
İşimiz bitince telefonu kapatmak gibidir. Kapatmazsak sunucu meşgul kalır, sistem şişer.

🧠 Özet
Bu kodun yaptığı iş:

Adresi al (SERVER_NAME).

Pasaportu hazırla (conn_str).

Kapıyı çal ve içeri gir (connect).

İçerideki listeyi iste (SELECT...).

Listeyi oku (print).

Çıkarken kapıyı kapat (close)."""