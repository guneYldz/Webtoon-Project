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
import SeriesDetailView from "@/components/SeriesDetailView";

const getWebtoon = cache(async (id) => {
  return fetchSsrJson(`/webtoons/${encodeRouteParam(id)}`, { revalidate: 60 });
});

export async function generateMetadata({ params }) {
  const { id } = params;
  const decodedId = decodeRouteParam(id);
  let result;
  try {
    result = await getWebtoon(id);
  } catch {
    return {
      title: "Kaos Manga - Türkçe Webtoon ve Manga",
      robots: { index: false, follow: false },
    };
  }

  if (result.status !== "ok") {
    return {
      title: "Seri Bulunamadı",
      robots: { index: false, follow: false },
    };
  }

  const series = result.data;
  const canonicalSlug = String(series.slug || decodedId);
  const encodedSlug = encodeRouteParam(canonicalSlug);
  const kind = seriesKindTr(series.type, series.typeLabel);
  const title = `${series.title} Oku - Türkçe ${kind}`;
  const description = series.summary
    ? String(series.summary).slice(0, 155)
    : `${series.title} Türkçe ${kind.toLowerCase()} oku. Kaos Manga'da ücretsiz webtoon, manga ve novel.`;
  const canonicalUrl = `${SITE_URL}/webtoon/${encodedSlug}`;
  const coverUrl = series.cover_image
    ? resolveMediaUrl(series.cover_image)
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
      images: [{ url: coverUrl, alt: `${series.title} ${kind} kapağı` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [coverUrl],
    },
  };
}

export default async function WebtoonDetailPage({ params }) {
  const { id } = params;
  const decodedId = decodeRouteParam(id);
  const result = await getWebtoon(id);

  if (result.status === "not_found") {
    notFound();
  }

  const series = result.data;
  const canonicalSlug = String(series.slug || decodedId);
  const encodedSlug = encodeRouteParam(canonicalSlug);

  if (series.slug && decodedId !== String(series.slug)) {
    permanentRedirect(`/webtoon/${encodedSlug}`);
  }

  const canonicalUrl = `${SITE_URL}/webtoon/${encodedSlug}`;
  const kind = seriesKindTr(series.type, series.typeLabel);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ComicSeries",
    name: series.title,
    description: series.summary || `${series.title} Türkçe ${kind} oku`,
    genre: kind,
    inLanguage: "tr-TR",
    url: canonicalUrl,
    image: series.cover_image ? resolveMediaUrl(series.cover_image) : undefined,
    publisher: {
      "@type": "Organization",
      name: "Kaos Manga",
      url: SITE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SeriesDetailView
        series={series}
        type="webtoon"
        routeKey={canonicalSlug}
      />
    </>
  );
}
