import { cache } from "react";
import { notFound } from "next/navigation";
import { apiFetch, resolveMediaUrl, SITE_URL } from "@/lib/apiClient";
import SeriesDetailView from "@/components/SeriesDetailView";

const getNovel = cache(async (slug) => {
  try {
    const res = await apiFetch(`/novels/${encodeURIComponent(slug)}`, {
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
  const { slug } = params;
  const novel = await getNovel(slug);

  if (!novel) {
    return { title: "Roman Bulunamadı" };
  }

  const title = `${novel.title} Oku - Türkçe Novel`;
  const description = novel.summary
    ? String(novel.summary).slice(0, 155)
    : `${novel.title} Türkçe web novel oku. Kaos Manga'da ücretsiz oku.`;
  const canonicalUrl = `${SITE_URL}/novel/${novel.slug || slug}`;
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
  const novel = await getNovel(slug);

  if (!novel) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: novel.title,
    description: novel.summary || `${novel.title} Türkçe Novel oku`,
    author: novel.author
      ? { "@type": "Person", name: novel.author }
      : undefined,
    inLanguage: "tr-TR",
    url: `${SITE_URL}/novel/${novel.slug || slug}`,
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
      <SeriesDetailView series={novel} type="novel" routeKey={slug} />
    </>
  );
}
