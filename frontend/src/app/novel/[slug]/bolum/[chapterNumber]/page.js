import { API } from "@/api";
import NovelReadingClient from "@/components/NovelReadingClient";

// --- 1. SEO METADATA (Zaten Vardı) ---
export async function generateMetadata({ params }) {
  const { slug, chapterNumber } = params;
  const apiUrl = API || "http://127.0.0.1:8000";

  try {
    const res = await fetch(`${apiUrl}/novels/${slug}/chapters/${chapterNumber}`);
    if (!res.ok) return { title: "Bölüm Bulunamadı | Site Adı" };

    const chapter = await res.json();

    return {
      title: `${chapter.title} Oku - ${chapter.novel_title} | Site Adı`,
      description: `${chapter.novel_title} serisinin ${chapter.chapter_number}. bölümünü şimdi oku. Özet: ${chapter.content ? chapter.content.substring(0, 150) : ""}...`,
      alternates: {
        canonical: `http://localhost:3000/novel/${slug}/bolum/${chapterNumber}`,
      },
      // Sosyal Medya (Open Graph)
      openGraph: {
        title: `${chapter.title} - ${chapter.novel_title}`,
        description: "En yeni novel bölümlerini hemen oku.",
        images: chapter.novel_cover ? [`${apiUrl}/${chapter.novel_cover}`] : [],
        type: "book",
      }
    };
  } catch (error) {
    return { title: "Hata | Site Adı" };
  }
}

// --- 2. SAYFA BİLEŞENİ (SCHEMA EKLENDİ 🔥) ---
export default async function Page({ params }) {
  const { slug, chapterNumber } = params;
  const apiUrl = API || "http://127.0.0.1:8000";

  // Veriyi burada da çekiyoruz (Next.js cache sayesinde çift istek gitmez, hızlıdır)
  let chapter = null;
  try {
    const res = await fetch(`${apiUrl}/novels/${slug}/chapters/${chapterNumber}`);
    if (res.ok) {
      chapter = await res.json();
    }
  } catch (err) {
    console.error("Schema veri hatası:", err);
  }

  // --- GOOGLE İÇİN GİZLİ MEKTUP (JSON-LD) ---
  // Eğer veri geldiyse şemayı oluştur, gelmediyse null olsun
  const jsonLd = chapter ? {
    "@context": "https://schema.org",
    "@type": "Chapter", // Google'a bunun bir Bölüm olduğunu söylüyoruz
    "headline": chapter.title,
    "position": chapter.chapter_number, // Bölüm sırası
    "datePublished": chapter.created_at, // Yayın tarihi
    "image": chapter.novel_cover ? `${apiUrl}/${chapter.novel_cover}` : undefined,
    "isPartOf": {
      "@type": "Book", // Hangi kitaba ait?
      "name": chapter.novel_title,
      "url": `http://localhost:3000/novel/${slug}` // Canlıda burayı site adın yaparsın
    }
  } : null;

  return (
    <>
      {/* Gizli Schema Kodunu Sayfaya Gömüyoruz */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Kullanıcının Gördüğü Kısım */}
      <NovelReadingClient slug={slug} chapterNumber={chapterNumber} />
    </>
  );
}