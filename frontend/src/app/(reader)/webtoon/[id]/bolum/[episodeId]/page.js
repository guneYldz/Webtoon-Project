import { cache } from "react";
import { notFound } from "next/navigation";
import { apiFetch, resolveMediaUrl, SITE_URL } from "@/lib/apiClient";
import { seriesKindTr } from "@/lib/seriesType";
import WebtoonReadingClient from "@/components/WebtoonReadingClient";

const getEpisode = cache(async (episodeId) => {
  try {
    const res = await apiFetch(`/episodes/${encodeURIComponent(episodeId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.detail) return null;
    return data;
  } catch {
    return null;
  }
});

const getSeriesEpisodes = cache(async (seriesId) => {
  try {
    const res = await apiFetch(`/webtoons/${encodeURIComponent(seriesId)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.episodes) ? data.episodes : [];
    return [...list].sort(
      (a, b) => Number(b.episode_number) - Number(a.episode_number)
    );
  } catch {
    return [];
  }
});

export async function generateMetadata({ params }) {
  const { id, episodeId } = params;
  const episode = await getEpisode(episodeId);

  if (!episode) {
    return { title: "Bölüm Bulunamadı" };
  }

  const kind = seriesKindTr(episode.series_type);
  const title = `Bölüm ${episode.episode_number} - ${episode.webtoon_title} ${kind} Oku`;
  const description = `${episode.webtoon_title} serisinin ${episode.episode_number}. bölümünü Kaos Manga'da Türkçe ${kind.toLowerCase()} olarak oku.`;
  const canonicalUrl = `${SITE_URL}/webtoon/${id}/bolum/${episodeId}`;
  const coverUrl = episode.webtoon_cover
    ? resolveMediaUrl(episode.webtoon_cover)
    : "/og-image.png";

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "book",
      url: canonicalUrl,
      images: [{ url: coverUrl, alt: `${episode.webtoon_title} kapağı` }],
    },
  };
}

export default async function WebtoonReadingPage({ params }) {
  const { id, episodeId } = params;
  const [episode, episodes] = await Promise.all([
    getEpisode(episodeId),
    getSeriesEpisodes(id),
  ]);

  if (!episode) {
    notFound();
  }

  const normalizedEpisode = {
    ...episode,
    webtoon_cover: episode.webtoon_cover
      ? resolveMediaUrl(episode.webtoon_cover)
      : episode.webtoon_cover,
    images: Array.isArray(episode.images)
      ? episode.images.map((u) => resolveMediaUrl(u))
      : [],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ComicIssue",
    headline: `Bölüm ${episode.episode_number} - ${episode.webtoon_title}`,
    issueNumber: episode.episode_number,
    datePublished: episode.created_at,
    image: episode.webtoon_cover
      ? resolveMediaUrl(episode.webtoon_cover)
      : undefined,
    isPartOf: {
      "@type": "ComicSeries",
      name: episode.webtoon_title,
      genre: seriesKindTr(episode.series_type),
      url: `${SITE_URL}/webtoon/${episode.webtoon_slug || id}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WebtoonReadingClient
        seriesId={id}
        episodeId={episodeId}
        initialEpisode={normalizedEpisode}
        initialEpisodes={episodes}
      />
    </>
  );
}
