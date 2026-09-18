import WebtoonReadingClient from "@/components/WebtoonReadingClient";
import { serverFetch, siteUrl } from "@/lib/serverApi";

export async function generateMetadata({ params }) {
  const { id, episodeId } = params;
  const episode = await serverFetch(`/episodes/${episodeId}`);
  const seriesKey = episode?.webtoon_slug || id;
  const canonical = siteUrl(`/webtoon/${seriesKey}/bolum/${episodeId}`);

  if (!episode) {
    return {
      title: "Bölüm | Kaos Manga",
      alternates: { canonical },
    };
  }

  return {
    title: `Bölüm ${episode.episode_number} - ${episode.webtoon_title} Oku | Kaos Manga`,
    description: `${episode.webtoon_title} serisinin ${episode.episode_number}. bölümünü yüksek kalitede oku.`,
    alternates: { canonical },
    openGraph: {
      title: `Bölüm ${episode.episode_number} - ${episode.webtoon_title} OKU`,
      description: "En yeni webtoon bölümleri burada.",
      images: episode.webtoon_cover ? [episode.webtoon_cover] : [],
      type: "book",
    },
  };
}

export default async function WebtoonReadingPage({ params }) {
  const { id, episodeId } = params;
  const episode = await serverFetch(`/episodes/${episodeId}`);
  const seriesKey = episode?.webtoon_slug || id;

  const jsonLd = episode
    ? {
        "@context": "https://schema.org",
        "@type": "ComicIssue",
        headline: `Bölüm ${episode.episode_number} - ${episode.webtoon_title}`,
        issueNumber: episode.episode_number,
        datePublished: episode.created_at,
        image: episode.webtoon_cover || undefined,
        isPartOf: {
          "@type": "ComicSeries",
          name: episode.webtoon_title,
          url: siteUrl(`/webtoon/${seriesKey}`),
        },
      }
    : null;

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
