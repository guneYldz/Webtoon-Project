import { cache } from "react";
import { notFound } from "next/navigation";
import {
  encodeRouteParam,
  fetchSsrJson,
  resolveMediaUrl,
  SITE_URL,
} from "@/lib/apiClient";
import NovelReadingClient from "@/components/NovelReadingClient";

const getNovelChapter = cache(async (slug, chapterNumber) => {
  return fetchSsrJson(
    `/novels/${encodeRouteParam(slug)}/chapters/${encodeRouteParam(chapterNumber)}`,
    { cache: "no-store" }
  );
});

const getNovelChapters = cache(async (slug) => {
  try {
    const res = await fetchSsrJson(`/novels/${encodeRouteParam(slug)}`, {
      revalidate: 60,
    });
    if (res.status !== "ok") return [];
    const list = Array.isArray(res.data?.chapters) ? res.data.chapters : [];
    return [...list].sort(
      (a, b) => Number(b.chapter_number) - Number(a.chapter_number)
    );
  } catch {
    return [];
  }
});

export async function generateMetadata({ params }) {
  const { slug, chapterNumber } = params;
  let result;
  try {
    result = await getNovelChapter(slug, chapterNumber);
  } catch {
    return {
      title: `Bölüm ${chapterNumber} - Kaos Manga`,
      robots: { index: false, follow: false },
    };
  }

  const fallbackTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  if (result.status !== "ok") {
    return {
      title: `Bölüm ${chapterNumber} - ${fallbackTitle} Oku`,
    };
  }

  const chapter = result.data;
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
  const [chapterRes, chapters] = await Promise.all([
    getNovelChapter(slug, chapterNumber),
    getNovelChapters(slug),
  ]);

  if (chapterRes.status === "not_found") {
    notFound();
  }

  const chapter = chapterRes.data;

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
