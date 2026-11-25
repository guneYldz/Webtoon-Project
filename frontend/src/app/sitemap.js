import { apiFetch, SITE_URL } from "@/lib/apiClient";
import { formatChapterNumber } from "@/lib/chapterTitle";

// Force dynamic runtime generation to avoid build-time connection issues
export const dynamic = "force-dynamic";
export const revalidate = 600; // Revalidate every 10 minutes

function safeDate(value, fallback) {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export default async function sitemap() {
  const baseUrl = SITE_URL;
  let novels = [];
  let webtoons = [];

  try {
    const sitemapRes = await apiFetch("/sitemap-data", {
      next: { revalidate: 600 },
    });

    if (sitemapRes.ok) {
      const payload = await sitemapRes.json();
      if (Array.isArray(payload?.novels)) novels = payload.novels;
      if (Array.isArray(payload?.webtoons)) webtoons = payload.webtoons;
    }

    // Fallback if /sitemap-data is unavailable during rolling deploy
    if (novels.length === 0 && webtoons.length === 0) {
      const [novelRes, webtoonRes] = await Promise.all([
        apiFetch("/novels/?limit=1000", { next: { revalidate: 600 } }),
        apiFetch("/webtoons/?limit=1000", { next: { revalidate: 600 } }),
      ]);
      if (novelRes.ok) {
        const parsed = await novelRes.json();
        if (Array.isArray(parsed)) novels = parsed;
      }
      if (webtoonRes.ok) {
        const parsed = await webtoonRes.json();
        if (Array.isArray(parsed)) webtoons = parsed;
      }
    }
  } catch (error) {
    console.error("Sitemap oluşturulurken hata:", error);
  }

  // Compute latest content timestamp across all series/chapters for static discovery pages
  let latestContentMs = 0;
  const trackLatest = (dateObj) => {
    if (dateObj) {
      const ms = dateObj.getTime();
      if (ms > latestContentMs) latestContentMs = ms;
    }
  };

  // Dynamic novel series pages
  const novelRoutes = novels
    .filter((novel) => Boolean(novel?.slug))
    .map((novel) => {
      const lastMod =
        safeDate(novel.updated_at, novel.created_at) || new Date();
      trackLatest(lastMod);
      return {
        url: `${baseUrl}/novel/${novel.slug}`,
        lastModified: lastMod,
        changeFrequency: "daily",
        priority: 0.8,
      };
    });

  // Dynamic webtoon series pages
  const webtoonRoutes = webtoons
    .filter((webtoon) => Boolean(webtoon?.slug || webtoon?.id))
    .map((webtoon) => {
      const slugOrId = webtoon.slug || webtoon.id;
      const lastMod =
        safeDate(webtoon.updated_at, webtoon.created_at) || new Date();
      trackLatest(lastMod);
      return {
        url: `${baseUrl}/webtoon/${slugOrId}`,
        lastModified: lastMod,
        changeFrequency: "daily",
        priority: 0.8,
      };
    });

  // Novel chapter pages (normalized integer/decimal chapter numbers, never .0)
  const novelChapterRoutes = novels
    .filter((novel) => Boolean(novel?.slug))
    .flatMap((novel) =>
      (novel.chapters || []).map((chapter) => {
        const cleanNum = formatChapterNumber(chapter.chapter_number);
        const lastMod =
          safeDate(chapter.created_at, novel.updated_at || novel.created_at) ||
          new Date();
        trackLatest(lastMod);
        return {
          url: `${baseUrl}/novel/${novel.slug}/bolum/${cleanNum}`,
          lastModified: lastMod,
          changeFrequency: "weekly",
          priority: 0.6,
        };
      })
    );

  // Webtoon episode pages
  const webtoonEpisodeRoutes = webtoons
    .filter((webtoon) => Boolean(webtoon?.slug || webtoon?.id))
    .flatMap((webtoon) => {
      const slugOrId = webtoon.slug || webtoon.id;
      return (webtoon.episodes || []).map((episode) => {
        const lastMod =
          safeDate(
            episode.created_at,
            webtoon.updated_at || webtoon.created_at
          ) || new Date();
        trackLatest(lastMod);
        return {
          url: `${baseUrl}/webtoon/${slugOrId}/bolum/${episode.id}`,
          lastModified: lastMod,
          changeFrequency: "weekly",
          priority: 0.6,
        };
      });
    });

  const staticLastModified =
    latestContentMs > 0 ? new Date(latestContentMs) : new Date();

  // Static pages
  const staticRoutes = [
    "",
    "/kesfet",
    "/seriler",
    "/yeniler",
    "/duyurular",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: staticLastModified,
    changeFrequency: "daily",
    priority: route === "" ? 1 : 0.9,
  }));

  const allRoutes = [
    ...staticRoutes,
    ...novelRoutes,
    ...webtoonRoutes,
    ...novelChapterRoutes,
    ...webtoonEpisodeRoutes,
  ];

  // Deduplicate by URL preserving first entry
  const uniqueByUrl = new Map();
  for (const entry of allRoutes) {
    if (entry?.url && !uniqueByUrl.has(entry.url)) {
      uniqueByUrl.set(entry.url, entry);
    }
  }

  return Array.from(uniqueByUrl.values());
}
