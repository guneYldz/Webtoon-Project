import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import {
  decodeRouteParam,
  encodeRouteParam,
  fetchSsrJson,
  resolveMediaUrl,
  SITE_URL,
} from "@/lib/apiClient";
import { formatChapterNumber, isAutoChapterTitle } from "@/lib/chapterTitle";
import NovelReadingClient from "@/components/NovelReadingClient";

const getNovelChapter = cache(async (slug, chapterNumber) => {
  return fetchSsrJson(
    `/novels/${encodeRouteParam(slug)}/chapters/${encodeRouteParam(chapterNumber)}`,
    { revalidate: 300 }
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

function extractPlainText(rawContent) {
  return String(rawContent || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({ params }) {
  const { slug, chapterNumber } = params;
  const decodedSlug = decodeRouteParam(slug);
  const decodedChapterNum = decodeRouteParam(chapterNumber);
  let result;
  try {
    result = await getNovelChapter(slug, chapterNumber);
  } catch {
    return {
      title: `Bölüm ${decodedChapterNum} - Kaos Manga`,
      robots: { index: false, follow: false },
    };
  }

  const fallbackTitle = String(decodedSlug || "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  if (result.status !== "ok") {
    return {
      title: `Bölüm ${decodedChapterNum} - ${fallbackTitle} Oku`,
      robots: { index: false, follow: false },
    };
  }

  const chapter = result.data;
  const canonicalSlug = String(chapter.novel_slug || decodedSlug);
  const encodedSlug = encodeRouteParam(canonicalSlug);
  const cleanNum = formatChapterNumber(
    chapter.chapter_number ?? decodedChapterNum
  );
  const encodedNum = encodeRouteParam(cleanNum);
  const novelTitle = chapter.novel_title || fallbackTitle;
  const customTitle =
    chapter.title && !isAutoChapterTitle(chapter.title)
      ? String(chapter.title).trim()
      : null;

  const plainText = extractPlainText(chapter.content);
  const plainSnippet = plainText.slice(0, 140);

  const title = customTitle
    ? `${novelTitle} Bölüm ${cleanNum}: ${customTitle} - Türkçe Novel Oku`
    : `${novelTitle} Bölüm ${cleanNum} Oku - Türkçe Novel`;

  const description = customTitle
    ? `${novelTitle} ${cleanNum}. Bölüm (${customTitle}) Türkçe web novel oku. ${plainSnippet}...`
    : `${novelTitle} serisinin ${cleanNum}. bölümünü şimdi Türkçe oku. ${plainSnippet}...`;

  const canonicalUrl = `${SITE_URL}/novel/${encodedSlug}/bolum/${encodedNum}`;
  const coverUrl = chapter.novel_cover
    ? resolveMediaUrl(chapter.novel_cover)
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
      images: [{ url: coverUrl, alt: `${novelTitle} kapağı` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [coverUrl],
    },
  };
}

export default async function NovelReadingPage({ params }) {
  const { slug, chapterNumber } = params;
  const decodedSlug = decodeRouteParam(slug);
  const decodedChapterNum = decodeRouteParam(chapterNumber);
  const [chapterRes, chapters] = await Promise.all([
    getNovelChapter(slug, chapterNumber),
    getNovelChapters(slug),
  ]);

  if (chapterRes.status === "not_found") {
    notFound();
  }

  const chapter = chapterRes.data;
  const canonicalSlug = String(chapter.novel_slug || decodedSlug);
  const encodedSlug = encodeRouteParam(canonicalSlug);
  const cleanNum = formatChapterNumber(
    chapter.chapter_number ?? decodedChapterNum
  );
  const encodedNum = encodeRouteParam(cleanNum);

  if (
    decodedSlug !== canonicalSlug ||
    decodedChapterNum !== String(cleanNum)
  ) {
    permanentRedirect(`/novel/${encodedSlug}/bolum/${encodedNum}`);
  }

  const novelTitle = chapter.novel_title || canonicalSlug;
  const customTitle =
    chapter.title && !isAutoChapterTitle(chapter.title)
      ? String(chapter.title).trim()
      : null;
  const chapterHeading = customTitle
    ? `Bölüm ${cleanNum}: ${customTitle}`
    : `Bölüm ${cleanNum}`;

  const plainText = extractPlainText(chapter.content);
  const wordCount = plainText ? plainText.split(/\s+/).length : undefined;
  const plainSnippet = plainText.slice(0, 155) || undefined;
  const canonicalUrl = `${SITE_URL}/novel/${encodedSlug}/bolum/${encodedNum}`;
  const seriesUrl = `${SITE_URL}/novel/${encodedSlug}`;
  const coverUrl = chapter.novel_cover
    ? resolveMediaUrl(chapter.novel_cover)
    : undefined;
  const numericPosition = Number(cleanNum);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Chapter",
        headline: `${novelTitle} - ${chapterHeading}`,
        name: chapterHeading,
        position: Number.isFinite(numericPosition) ? numericPosition : cleanNum,
        url: canonicalUrl,
        inLanguage: "tr-TR",
        datePublished: chapter.created_at,
        wordCount,
        description: plainSnippet,
        image: coverUrl,
        isPartOf: {
          "@type": "Book",
          name: novelTitle,
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
            name: novelTitle,
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
      <NovelReadingClient
        slug={canonicalSlug}
        chapterNumber={cleanNum}
        initialChapter={chapter}
        initialChapters={chapters}
      />
    </>
  );
}
