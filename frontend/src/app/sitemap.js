import { apiFetch, SITE_URL } from "@/lib/apiClient";

// Force dynamic to avoid build-time issues
export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate every hour

function safeDate(value, fallback) {
  const candidate = value || fallback;
  if (!candidate) return new Date();
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

export default async function sitemap() {
  const baseUrl = SITE_URL;
  let novels = [];
  let webtoons = [];

  try {
    const [novelRes, webtoonRes] = await Promise.all([
      apiFetch("/novels/", { cache: "no-store" }),
      apiFetch("/webtoons/", { cache: "no-store" }),
    ]);
    if (novelRes.ok) {
      const parsed = await novelRes.json();
      if (Array.isArray(parsed)) novels = parsed;
    }
    if (webtoonRes.ok) {
      const parsed = await webtoonRes.json();
      if (Array.isArray(parsed)) webtoons = parsed;
    }
  } catch (error) {
    console.error("Sitemap oluşturulurken hata:", error);
  }

  // Static pages
  const staticRoutes = [
    "",
    "/kesfet",
    "/seriler",
    "/yeniler",
    "/duyurular",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: route === "" ? 1 : 0.9,
  }));

  // Dynamic novel series pages
  const novelRoutes = novels.map((novel) => ({
    url: `${baseUrl}/novel/${novel.slug}`,
    lastModified: safeDate(novel.updated_at, novel.created_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Dynamic webtoon series pages
  const webtoonRoutes = webtoons.map((webtoon) => ({
    url: `${baseUrl}/webtoon/${webtoon.slug || webtoon.id}`,
    lastModified: safeDate(webtoon.updated_at, webtoon.created_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Novel chapter pages (bölüm bazlı indeksleme)
  const novelChapterRoutes = novels.flatMap((novel) =>
    (novel.chapters || []).map((chapter) => ({
      url: `${baseUrl}/novel/${novel.slug}/bolum/${chapter.chapter_number}`,
      lastModified: safeDate(chapter.created_at, novel.created_at),
      changeFrequency: "weekly",
      priority: 0.6,
    }))
  );

  // Webtoon episode pages
  const webtoonEpisodeRoutes = webtoons.flatMap((webtoon) =>
    (webtoon.episodes || []).map((episode) => ({
      url: `${baseUrl}/webtoon/${webtoon.slug || webtoon.id}/bolum/${episode.id}`,
      lastModified: safeDate(episode.created_at, webtoon.created_at),
      changeFrequency: "weekly",
      priority: 0.6,
    }))
  );

  return [
    ...staticRoutes,
    ...novelRoutes,
    ...webtoonRoutes,
    ...novelChapterRoutes,
    ...webtoonEpisodeRoutes,
  ];
}
