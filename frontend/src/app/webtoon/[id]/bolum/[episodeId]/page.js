import { API } from "@/api";
import WebtoonReadingClient from "@/components/WebtoonReadingClient";

// 1. Next.js'in özel SEO fonksiyonu
export async function generateMetadata({ params }) {
  const { id, episodeId } = params;
  const apiUrl = API || "http://127.0.0.1:8000";

  try {
    const res = await fetch(`${apiUrl}/episodes/${episodeId}`);
    if (!res.ok) return { title: "Bölüm Bulunamadı" };

    const episode = await res.json();

    return {
      title: `Bölüm ${episode.episode_number} - ${episode.webtoon_title} Oku | Site Adı`,
      description: `${episode.webtoon_title} serisinin ${episode.episode_number}. bölümünü yüksek kalitede oku.`,
      alternates: {
        canonical: `http://localhost:3000/webtoon/${id}/bolum/${episodeId}`,
      },
      openGraph: {
        title: `Bölüm ${episode.episode_number} - ${episode.webtoon_title} OKU`,
        description: "En yeni webtoon bölümleri burada.",
        images: episode.webtoon_cover ? [`${apiUrl}/${episode.webtoon_cover}`] : [],
        type: "book", // veya 'website'
      }
    };
  } catch (error) {
    return { title: "Hata" };
  }
}

export default async function WebtoonReadingPage({ params }) {
  const { id, episodeId } = params;
  const apiUrl = API || "http://127.0.0.1:8000";

  // Schema için veriyi çek
  let episode = null;
  try {
    const res = await fetch(`${apiUrl}/episodes/${episodeId}`);
    if (res.ok) {
      episode = await res.json();
    }
  } catch (err) {
    console.error("Schema hata:", err);
  }

  // --- JSON-LD (Webtoon İçin) ---
  const jsonLd = episode ? {
    "@context": "https://schema.org",
    "@type": "ComicIssue", // Webtoon için en uygun tip
    "headline": `Bölüm ${episode.episode_number} - ${episode.webtoon_title}`,
    "issueNumber": episode.episode_number,
    "datePublished": episode.created_at,
    "image": episode.webtoon_cover ? `${apiUrl}/${episode.webtoon_cover}` : undefined,
    "isPartOf": {
      "@type": "ComicSeries",
      "name": episode.webtoon_title,
      "url": `http://localhost:3000/webtoon/${id}`
    }
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <WebtoonReadingClient seriesId={id} episodeId={episodeId} />
    </>
  );
}