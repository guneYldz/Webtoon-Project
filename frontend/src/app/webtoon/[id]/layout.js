import { seriesKindTr } from "@/lib/seriesType";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kaosmanga.net";
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

async function fetchSeries(id) {
  const apiUrl = "http://backend:8000";
  const res = await fetch(`${apiUrl}/webtoons/${id}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }) {
  const { id } = params;

  try {
    const series = await fetchSeries(id);
    if (!series) {
      return { title: "Seri Bulunamadı" };
    }
    const kind = seriesKindTr(series.type);
    const title = `${series.title} Oku - Türkçe ${kind}`;
    const description = series.summary
      ? String(series.summary).slice(0, 155)
      : `${series.title} Türkçe ${kind.toLowerCase()} oku. Kaos Manga'da ücretsiz webtoon, manga ve novel.`;

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
        canonical: `${SITE}/webtoon/${series.slug || id}`,
      },
      openGraph: {
        title,
        description,
        type: "book",
        url: `${SITE}/webtoon/${series.slug || id}`,
        images: series.cover_image
          ? [{ url: `${PUBLIC_API}/${series.cover_image}`, alt: `${series.title} ${kind} kapağı` }]
          : ["/og-image.png"],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return { title: "Seri" };
  }
}

export default async function WebtoonSeriesLayout({ children, params }) {
  const { id } = params;
  let jsonLd = null;
  try {
    const series = await fetchSeries(id);
    if (series?.title) {
      const kind = seriesKindTr(series.type);
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "ComicSeries",
        name: series.title,
        description: series.summary || `${series.title} Türkçe ${kind} oku`,
        genre: kind,
        inLanguage: "tr-TR",
        url: `${SITE}/webtoon/${series.slug || id}`,
        image: series.cover_image ? `${PUBLIC_API}/${series.cover_image}` : undefined,
        publisher: {
          "@type": "Organization",
          name: "Kaos Manga",
          url: SITE,
        },
      };
    }
  } catch {
    jsonLd = null;
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
