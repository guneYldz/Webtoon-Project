import NovelReadingClient from "@/components/NovelReadingClient";
import { serverFetch, siteUrl } from "@/lib/serverApi";

function novelNameFromSlug(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }) {
  const { slug, chapterNumber } = params;
  const fallbackTitle = `Bölüm ${chapterNumber} - ${novelNameFromSlug(slug)} Oku | Kaos Manga`;
  const canonical = siteUrl(`/novel/${slug}/bolum/${chapterNumber}`);
  const chapter = await serverFetch(`/novels/${slug}/chapters/${chapterNumber}`);

  if (!chapter) {
    return {
      title: fallbackTitle,
      alternates: { canonical },
    };
  }

  const novelTitle = chapter.novel_title || novelNameFromSlug(slug);
  return {
    title: `Bölüm ${chapter.chapter_number} - ${novelTitle} Oku | Kaos Manga`,
    description: `${novelTitle} serisinin ${chapter.chapter_number}. bölümünü şimdi oku.`,
    alternates: { canonical },
    openGraph: {
      title: `Bölüm ${chapter.chapter_number} - ${novelTitle}`,
      description: "En yeni novel bölümlerini hemen oku.",
      images: chapter.novel_cover ? [chapter.novel_cover] : [],
      type: "book",
    },
  };
}

export default async function Page({ params }) {
  const { slug, chapterNumber } = params;
  const chapter = await serverFetch(`/novels/${slug}/chapters/${chapterNumber}`);

  const jsonLd = chapter
    ? {
        "@context": "https://schema.org",
        "@type": "Chapter",
        headline: chapter.title,
        position: chapter.chapter_number,
        datePublished: chapter.created_at,
        image: chapter.novel_cover || undefined,
        isPartOf: {
          "@type": "Book",
          name: chapter.novel_title,
          url: siteUrl(`/novel/${slug}`),
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <NovelReadingClient slug={slug} chapterNumber={chapterNumber} />
    </>
  );
}
