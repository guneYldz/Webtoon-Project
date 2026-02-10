import { API } from "@/api";
import WebtoonReadingClient from "@/components/WebtoonReadingClient";

// 1. Next.js'in özel SEO fonksiyonu
export async function generateMetadata({ params }) {
  const { id, episodeId } = params;
  // Docker container içinden backend'e erişim için (Server-Side)
  const apiUrl = "http://backend:8000";

  try {
    const res = await fetch(`${apiUrl}/episodes/${episodeId}`);
    if (!res.ok) return { title: "Bölüm Bulunamadı | Kaos Manga" };

    const episode = await res.json();

    return {
      title: `Bölüm ${episode.episode_number} - ${episode.webtoon_title} Oku | Kaos Manga`,
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
  // Docker container içinden backend'e erişim için (Server-Side)
  const apiUrl = "http://backend:8000";

  // Schema için veriyi çek
  let episode = null;
  try {
    const res = await fetch(`${apiUrl}/episodes/${episodeId}`);
    if (res.ok) {
      episode = await res.json();

      // 🔥 KRİTİK: Backend URL'lerini Client'ın kullanabileceği localhost URL'lerine çevir
      if (episode) {
        const clientApiUrl = "http://localhost:8000";

        // Cover image URL'ini değiştir
        if (episode.webtoon_cover && episode.webtoon_cover.includes("backend:8000")) {
          episode.webtoon_cover = episode.webtoon_cover.replace("http://backend:8000", clientApiUrl);
        }

        // Episode images array'ini değiştir
        if (episode.images && Array.isArray(episode.images)) {
          episode.images = episode.images.map(imgUrl => {
            if (typeof imgUrl === 'string' && imgUrl.includes("backend:8000")) {
              return imgUrl.replace("http://backend:8000", clientApiUrl);
            }
            return imgUrl;
          });
        }
      }
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
      <WebtoonReadingClient seriesId={id} episodeId={episodeId} initialEpisode={episode} />
    </>
  );
}