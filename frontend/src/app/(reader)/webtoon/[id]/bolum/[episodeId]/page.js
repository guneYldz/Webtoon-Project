import { cache } from "react";
import { notFound } from "next/navigation";
import {
  encodeRouteParam,
  fetchSsrJson,
  resolveMediaUrl,
  SITE_URL,
} from "@/lib/apiClient";
import { seriesKindTr } from "@/lib/seriesType";
import WebtoonReadingClient from "@/components/WebtoonReadingClient";

const getEpisode = cache(async (episodeId) => {
  return fetchSsrJson(`/episodes/${encodeRouteParam(episodeId)}`, {
    cache: "no-store",
  });
});

const getSeriesEpisodes = cache(async (seriesId) => {
  try {
    const res = await fetchSsrJson(`/webtoons/${encodeRouteParam(seriesId)}`, {
      revalidate: 60,
    });
    if (res.status !== "ok") return [];
    const list = Array.isArray(res.data?.episodes) ? res.data.episodes : [];
    return [...list].sort(
      (a, b) => Number(b.episode_number) - Number(a.episode_number)
    );
  } catch {
    return [];
  }
});

export async function generateMetadata({ params }) {
  const { id, episodeId } = params;
  let result;
  try {
    result = await getEpisode(episodeId);
  } catch {
    return {
      title: "Kaos Manga - Bölüm Yükleniyor",
      robots: { index: false, follow: false },
    };
  }

  if (result.status !== "ok") {
    return { title: "Bölüm Bulunamadı" };
  }

  const episode = result.data;
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
  const [episodeRes, episodes] = await Promise.all([
    getEpisode(episodeId),
    getSeriesEpisodes(id),
  ]);

  if (episodeRes.status === "not_found") {
    notFound();
  }

  const episode = episodeRes.data;

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
