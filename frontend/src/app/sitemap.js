import { API } from "@/api";

export default async function sitemap() {
  // 1. Backend'den Tüm Romanları Çek
  // Eğer API adresin boş gelirse localhost kullan
  const apiUrl = API || "http://127.0.0.1:8000";
  let novels = [];

  try {
    const res = await fetch(`${apiUrl}/novels/`, {
      cache: 'no-store' // Hep taze veri olsun
    });
    if (res.ok) {
      novels = await res.json();
    }
  } catch (error) {
    console.error("Sitemap oluşturulurken hata:", error);
  }

  // 2. Sabit Sayfaları Tanımla
  const staticRoutes = [
    "",          // Anasayfa (localhost:3000/)
    "/kesfet",   // Keşfet Sayfası
    "/seriler",  // Seriler Listesi
  ].map((route) => ({
    url: `http://localhost:3000${route}`, // Canlıya geçince burayı site adınla değiştirirsin
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1,
  }));

  // 3. Dinamik Roman Sayfalarını Haritaya Ekle
  const novelRoutes = novels.map((novel) => ({
    url: `http://localhost:3000/novel/${novel.slug}`,
    lastModified: new Date(novel.updated_at || novel.created_at), // Varsa güncelleme, yoksa oluşma tarihi
    changeFrequency: "daily", // Romanlar sık güncellenir
    priority: 0.8,
  }));

  // 4. Hepsini Birleştir ve Gönder
  return [...staticRoutes, ...novelRoutes];
}