import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import {
  decodeRouteParam,
  encodeRouteParam,
  fetchSsrJson,
  resolveMediaUrl,
  SITE_URL,
} from "@/lib/apiClient";
import { seriesKindTr } from "@/lib/seriesType";
import { formatChapterNumber, isAutoChapterTitle } from "@/lib/chapterTitle";
import WebtoonReadingClient from "@/components/WebtoonReadingClient";

const getEpisode = cache(async (episodeId) => {
  return fetchSsrJson(`/episodes/${encodeRouteParam(episodeId)}`, {
    revalidate: 300,
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
  const decodedId = decodeRouteParam(id);
  const decodedEpisodeId = decodeRouteParam(episodeId);
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
    return {
      title: "Bölüm Bulunamadı",
      robots: { index: false, follow: false },
    };
  }

  const episode = result.data;
  const canonicalSlug = String(episode.webtoon_slug || decodedId);
  const encodedSlug = encodeRouteParam(canonicalSlug);
  const canonicalEpisodeId = String(episode.id ?? decodedEpisodeId);
  const encodedEpisodeId = encodeRouteParam(canonicalEpisodeId);
  const cleanNum = formatChapterNumber(episode.episode_number);
  const kind = seriesKindTr(episode.series_type);
  const customTitle =
    episode.title && !isAutoChapterTitle(episode.title)
      ? String(episode.title).trim()
      : null;
  const pageCount = Array.isArray(episode.images) ? episode.images.length : 0;

  const title = customTitle
    ? `${episode.webtoon_title} Bölüm ${cleanNum}: ${customTitle} - Türkçe ${kind} Oku`
    : `${episode.webtoon_title} Bölüm ${cleanNum} - Türkçe ${kind} Oku`;

  const description = `${episode.webtoon_title} serisinin ${cleanNum}. bölümünü${
    customTitle ? ` (${customTitle})` : ""
  }${
    pageCount > 0 ? ` ${pageCount} sayfa yüksek kalitede` : ""
  } Kaos Manga'da Türkçe ${kind.toLowerCase()} olarak ücretsiz oku.`;

  const canonicalUrl = `${SITE_URL}/webtoon/${encodedSlug}/bolum/${encodedEpisodeId}`;
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
      type: "article",
      url: canonicalUrl,
      images: [{ url: coverUrl, alt: `${episode.webtoon_title} kapağı` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [coverUrl],
    },
  };
}

export default async function WebtoonReadingPage({ params }) {
  const { id, episodeId } = params;
  const decodedId = decodeRouteParam(id);
  const decodedEpisodeId = decodeRouteParam(episodeId);
  const [episodeRes, episodes] = await Promise.all([
    getEpisode(episodeId),
    getSeriesEpisodes(id),
  ]);

  if (episodeRes.status === "not_found") {
    notFound();
  }

  const episode = episodeRes.data;
  const canonicalSlug = String(episode.webtoon_slug || decodedId);
  const encodedSlug = encodeRouteParam(canonicalSlug);
  const canonicalEpisodeId = String(episode.id ?? decodedEpisodeId);
  const encodedEpisodeId = encodeRouteParam(canonicalEpisodeId);

  if (
    decodedId !== canonicalSlug ||
    decodedEpisodeId !== canonicalEpisodeId
  ) {
    permanentRedirect(`/webtoon/${encodedSlug}/bolum/${encodedEpisodeId}`);
  }

  const cleanNum = formatChapterNumber(episode.episode_number);
  const kind = seriesKindTr(episode.series_type);
  const customTitle =
    episode.title && !isAutoChapterTitle(episode.title)
      ? String(episode.title).trim()
      : null;
  const chapterHeading = customTitle
    ? `Bölüm ${cleanNum}: ${customTitle}`
    : `Bölüm ${cleanNum}`;

  const normalizedEpisode = {
    ...episode,
    webtoon_cover: episode.webtoon_cover
      ? resolveMediaUrl(episode.webtoon_cover)
      : episode.webtoon_cover,
    images: Array.isArray(episode.images)
      ? episode.images.map((u) => resolveMediaUrl(u))
      : [],
  };

  const canonicalUrl = `${SITE_URL}/webtoon/${encodedSlug}/bolum/${encodedEpisodeId}`;
  const seriesUrl = `${SITE_URL}/webtoon/${encodedSlug}`;
  const coverUrl = episode.webtoon_cover
    ? resolveMediaUrl(episode.webtoon_cover)
    : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ComicIssue",
        headline: `${episode.webtoon_title} - ${chapterHeading}`,
        name: chapterHeading,
        issueNumber: cleanNum,
        url: canonicalUrl,
        inLanguage: "tr-TR",
        datePublished: episode.created_at,
        numberOfPages: normalizedEpisode.images.length || undefined,
        image: coverUrl,
        isPartOf: {
          "@type": "ComicSeries",
          name: episode.webtoon_title,
          genre: kind,
          url: seriesUrl,
        },
        publisher: {
          "@type": "Organization",
          name: "Kaos Manga",
          url: SITE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/logo.png`,
          },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Anasayfa",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: episode.webtoon_title,
            item: seriesUrl,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: chapterHeading,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WebtoonReadingClient
        seriesId={canonicalSlug}
        episodeId={canonicalEpisodeId}
        initialEpisode={normalizedEpisode}
        initialEpisodes={episodes}
      />
    </>
  );
}
