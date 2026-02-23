import { API } from "@/api";
import NovelReadingClient from "@/components/NovelReadingClient";

// --- 1. SEO METADATA (Zaten Vardı) ---
export async function generateMetadata({ params }) {
  const { slug, chapterNumber } = params;
  const clientApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.kaosmanga.net";
  const apiUrl = typeof window === 'undefined' ? 'http://backend:8000' : clientApiUrl;

  // Slug'dan okunabilir roman adı üret (fallback için)
  const novelNameFromSlug = slug
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  try {
    const res = await fetch(`${apiUrl}/novels/${slug}/chapters/${chapterNumber}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        title: `Bölüm ${chapterNumber} - ${novelNameFromSlug} Oku | Kaos Manga`,
      };
    }

    const chapter = await res.json();
    const novelTitle = chapter.novel_title || novelNameFromSlug;

    return {
      title: `Bölüm ${chapter.chapter_number} - ${novelTitle} Oku | Kaos Manga`,
      description: `${novelTitle} serisinin ${chapter.chapter_number}. bölümünü şimdi oku. Özet: ${chapter.content ? chapter.content.substring(0, 150) : ""}...`,
      alternates: {
        canonical: `https://kaosmanga.com/novel/${slug}/bolum/${chapterNumber}`,
      },
      openGraph: {
        title: `Bölüm ${chapter.chapter_number} - ${novelTitle}`,
        description: "En yeni novel bölümlerini hemen oku.",
        images: chapter.novel_cover ? [`${apiUrl}/${chapter.novel_cover}`] : [],
        type: "book",
      }
    };
  } catch (error) {
    return {
      title: `Bölüm ${chapterNumber} - ${novelNameFromSlug} Oku | Kaos Manga`,
    };
  }
}

// --- 2. SAYFA BİLEŞENİ (SCHEMA EKLENDİ 🔥) ---
export default async function Page({ params }) {
  const { slug, chapterNumber } = params;
  const clientApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.kaosmanga.net";
  const apiUrl = typeof window === 'undefined' ? 'http://backend:8000' : clientApiUrl;

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
      "url": `https://kaosmanga.com/novel/${slug}`
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