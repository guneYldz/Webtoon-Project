import { serverFetch, siteUrl } from "@/lib/serverApi";

export async function generateMetadata({ params }) {
  const webtoon = await serverFetch(`/webtoons/${params.id}`);
  const seriesKey = webtoon?.slug || params.id;
  const canonical = siteUrl(`/webtoon/${seriesKey}`);

  if (!webtoon || webtoon.detail) {
    return {
      title: "Webtoon | Kaos Manga",
      alternates: { canonical },
    };
  }

  return {
    title: `${webtoon.title} Oku | Kaos Manga`,
    description: webtoon.summary
      ? webtoon.summary.slice(0, 160)
      : `${webtoon.title} webtoonunu Türkçe oku.`,
    alternates: { canonical },
  };
}

export default function WebtoonLayout({ children }) {
  return children;
}
