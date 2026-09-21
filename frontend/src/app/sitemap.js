import { serverFetch, siteUrl } from "@/lib/serverApi";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

function toDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function entry(path, lastModified, changeFrequency = "daily", priority = 0.7) {
  return {
    url: siteUrl(path),
    lastModified: toDate(lastModified),
    changeFrequency,
    priority,
  };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) || 0 }, () => worker())
  );
  return results;
}

export default async function sitemap() {
  const [novels, webtoons] = await Promise.all([
    serverFetch("/novels/?limit=500", { timeoutMs: 8000 }).then((data) =>
      Array.isArray(data) ? data : []
    ),
    serverFetch("/webtoons/?limit=500", { timeoutMs: 8000 }).then((data) =>
      Array.isArray(data) ? data : []
    ),
  ]);

  const staticRoutes = ["", "/kesfet", "/seriler", "/yeniler", "/duyurular", "/baglantilar"].map(
    (route) => entry(route, new Date(), "daily", 1)
  );

  const novelSeriesRoutes = novels
    .filter((novel) => novel?.slug)
    .map((novel) => entry(`/novel/${novel.slug}`, novel.updated_at || novel.created_at, "daily", 0.8));

  const webtoonSeriesRoutes = webtoons
    .filter((webtoon) => webtoon?.slug || webtoon?.id)
    .map((webtoon) =>
      entry(`/webtoon/${webtoon.slug || webtoon.id}`, webtoon.updated_at || webtoon.created_at, "daily", 0.8)
    );

  const webtoonChapterRoutes = webtoons.flatMap((webtoon) => {
    const seriesKey = webtoon.slug || webtoon.id;
    if (!seriesKey || !Array.isArray(webtoon.episodes)) return [];
    return webtoon.episodes
      .filter((episode) => episode?.id && episode.is_published !== false)
      .map((episode) =>
        entry(
          `/webtoon/${seriesKey}/bolum/${episode.id}`,
          episode.created_at || webtoon.updated_at,
          "weekly",
          0.6
        )
      );
  });

  const novelDetails = await mapLimit(
    novels.filter((novel) => novel?.slug),
    5,
    (novel) => serverFetch(`/novels/${novel.slug}`, { timeoutMs: 8000 })
  );

  const novelChapterRoutes = novelDetails.flatMap((novel) => {
    if (!novel?.slug || !Array.isArray(novel.chapters)) return [];
    return novel.chapters
      .filter((chapter) => chapter?.chapter_number != null)
      .map((chapter) =>
        entry(
          `/novel/${novel.slug}/bolum/${chapter.chapter_number}`,
          chapter.created_at || novel.updated_at,
          "weekly",
          0.6
        )
      );
  });

  return [
    ...staticRoutes,
    ...novelSeriesRoutes,
    ...webtoonSeriesRoutes,
    ...webtoonChapterRoutes,
    ...novelChapterRoutes,
  ];
}