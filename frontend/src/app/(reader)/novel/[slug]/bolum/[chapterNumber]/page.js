import { cache } from "react";
import { notFound } from "next/navigation";
import { apiFetch, resolveMediaUrl, SITE_URL } from "@/lib/apiClient";
import NovelReadingClient from "@/components/NovelReadingClient";

const getNovelChapter = cache(async (slug, chapterNumber) => {
  try {
    const res = await apiFetch(
      `/novels/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterNumber)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.detail) return null;
    return data;
  } catch {
    return null;
  }
});

const getNovelChapters = cache(async (slug) => {
  try {
    const res = await apiFetch(`/novels/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.chapters) ? data.chapters : [];
    return [...list].sort(
      (a, b) => Number(b.chapter_number) - Number(a.chapter_number)
    );
  } catch {
    return [];
  }
});

export async function generateMetadata({ params }) {
  const { slug, chapterNumber } = params;
  const chapter = await getNovelChapter(slug, chapterNumber);

  const fallbackTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  if (!chapter) {
    return {
      title: `Bölüm ${chapterNumber} - ${fallbackTitle} Oku`,
    };
  }

  const novelTitle = chapter.novel_title || fallbackTitle;
  const plainSnippet = String(chapter.content || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 145);

  const canonicalUrl = `${SITE_URL}/novel/${slug}/bolum/${chapterNumber}`;
  const coverUrl = chapter.novel_cover
    ? resolveMediaUrl(chapter.novel_cover)
    : "/og-image.png";

  return {
    title: `Bölüm ${chapter.chapter_number} - ${novelTitle} Oku`,
    description: `${novelTitle} serisinin ${chapter.chapter_number}. bölümünü şimdi oku. ${plainSnippet}...`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Bölüm ${chapter.chapter_number} - ${novelTitle}`,
      description: `En yeni novel bölümlerini Kaos Manga'da oku.`,
      type: "book",
      url: canonicalUrl,
      images: [{ url: coverUrl, alt: `${novelTitle} kapağı` }],
    },
  };
}

export default async function NovelReadingPage({ params }) {
  const { slug, chapterNumber } = params;
  const [chapter, chapters] = await Promise.all([
    getNovelChapter(slug, chapterNumber),
    getNovelChapters(slug),
  ]);

  if (!chapter) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Chapter",
    headline: chapter.title,
    position: chapter.chapter_number,
    datePublished: chapter.created_at,
    image: chapter.novel_cover
      ? resolveMediaUrl(chapter.novel_cover)
      : undefined,
    isPartOf: {
      "@type": "Book",
      name: chapter.novel_title,
      url: `${SITE_URL}/novel/${slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NovelReadingClient
        slug={slug}
        chapterNumber={chapterNumber}
        initialChapter={chapter}
        initialChapters={chapters}
      />
    </>
  );
}
