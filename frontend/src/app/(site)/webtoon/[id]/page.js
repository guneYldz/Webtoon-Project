import { cache } from "react";
import { notFound } from "next/navigation";
import { apiFetch, resolveMediaUrl, SITE_URL } from "@/lib/apiClient";
import { seriesKindTr } from "@/lib/seriesType";
import SeriesDetailView from "@/components/SeriesDetailView";

const getWebtoon = cache(async (id) => {
  try {
    const res = await apiFetch(`/webtoons/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.detail) return null;
    return data;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }) {
  const { id } = params;
  const series = await getWebtoon(id);

  if (!series) {
    return { title: "Seri Bulunamadı" };
  }

  const kind = seriesKindTr(series.type, series.typeLabel);
  const title = `${series.title} Oku - Türkçe ${kind}`;
  const description = series.summary
    ? String(series.summary).slice(0, 155)
    : `${series.title} Türkçe ${kind.toLowerCase()} oku. Kaos Manga'da ücretsiz webtoon, manga ve novel.`;
  const canonicalUrl = `${SITE_URL}/webtoon/${series.slug || id}`;
  const coverUrl = series.cover_image
    ? resolveMediaUrl(series.cover_image)
    : "/og-image.png";

  return {
    title,
    description,
    keywords: [
      series.title,
      `türkçe ${kind.toLowerCase()}`,
      `${kind.toLowerCase()} oku`,
      "kaos manga",
    ],
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
  const series = await getWebtoon(id);

  if (!series) {
    notFound();
  }

  const kind = seriesKindTr(series.type, series.typeLabel);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ComicSeries",
    name: series.title,
    description: series.summary || `${series.title} Türkçe ${kind} oku`,
    genre: kind,
    inLanguage: "tr-TR",
    url: `${SITE_URL}/webtoon/${series.slug || id}`,
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
      <SeriesDetailView series={series} type="webtoon" routeKey={id} />
    </>
  );
}
