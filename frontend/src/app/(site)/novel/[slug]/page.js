import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import {
  decodeRouteParam,
  encodeRouteParam,
  fetchSsrJson,
  resolveMediaUrl,
  SITE_URL,
} from "@/lib/apiClient";
import SeriesDetailView from "@/components/SeriesDetailView";

const getNovel = cache(async (slug) => {
  return fetchSsrJson(`/novels/${encodeRouteParam(slug)}`, { revalidate: 60 });
});

export async function generateMetadata({ params }) {
  const { slug } = params;
  const decodedSlug = decodeRouteParam(slug);
  let result;
  try {
    result = await getNovel(slug);
  } catch {
    return {
      title: "Kaos Manga - Türkçe Novel",
      robots: { index: false, follow: false },
    };
  }

  if (result.status !== "ok") {
    return {
      title: "Roman Bulunamadı",
      robots: { index: false, follow: false },
    };
  }

  const novel = result.data;
  const canonicalSlug = String(novel.slug || decodedSlug);
  const encodedSlug = encodeRouteParam(canonicalSlug);
  const title = `${novel.title} Oku - Türkçe Novel`;
  const description = novel.summary
    ? String(novel.summary).slice(0, 155)
    : `${novel.title} Türkçe web novel oku. Kaos Manga'da ücretsiz oku.`;
  const canonicalUrl = `${SITE_URL}/novel/${encodedSlug}`;
  const coverUrl = novel.cover_image
    ? resolveMediaUrl(novel.cover_image)
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
      images: [{ url: coverUrl, alt: `${novel.title} kapağı` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [coverUrl],
    },
  };
}

export default async function NovelDetailPage({ params }) {
  const { slug } = params;
  const decodedSlug = decodeRouteParam(slug);
  const result = await getNovel(slug);

  if (result.status === "not_found") {
    notFound();
  }

  const novel = result.data;
  const canonicalSlug = String(novel.slug || decodedSlug);
  const encodedSlug = encodeRouteParam(canonicalSlug);

  if (novel.slug && decodedSlug !== String(novel.slug)) {
    permanentRedirect(`/novel/${encodedSlug}`);
  }

  const canonicalUrl = `${SITE_URL}/novel/${encodedSlug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: novel.title,
    description: novel.summary || `${novel.title} Türkçe Novel oku`,
    author: novel.author
      ? { "@type": "Person", name: novel.author }
      : undefined,
    inLanguage: "tr-TR",
    url: canonicalUrl,
    numberOfPages: Array.isArray(novel.chapters)
      ? novel.chapters.length
      : undefined,
    image: novel.cover_image ? resolveMediaUrl(novel.cover_image) : undefined,
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
      <SeriesDetailView series={novel} type="novel" routeKey={canonicalSlug} />
    </>
  );
}
