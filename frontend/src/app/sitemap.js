import { API } from "@/api";

// Force dynamic to avoid build-time issues
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kaosmanga.net";
  const apiUrl = API || "https://kaosmanga.net/api";
  let novels = [];
  let webtoons = [];

  try {
    const [novelRes, webtoonRes] = await Promise.all([
      fetch(`${apiUrl}/novels/`, { cache: 'no-store' }),
      fetch(`${apiUrl}/webtoons/`, { cache: 'no-store' }),
    ]);
    if (novelRes.ok) novels = await novelRes.json();
    if (webtoonRes.ok) webtoons = await webtoonRes.json();
  } catch (error) {
    console.error("Sitemap oluşturulurken hata:", error);
    // Build fails gracefully, returns empty array
  }

  // Static pages
  const staticRoutes = [
    "",
    "/kesfet",
    "/seriler",
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
    lastModified: new Date(novel.updated_at || novel.created_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Dynamic webtoon series pages
  const webtoonRoutes = webtoons.map((webtoon) => ({
    url: `${baseUrl}/webtoon/${webtoon.slug || webtoon.id}`,
    lastModified: new Date(webtoon.updated_at || webtoon.created_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Novel chapter pages (bölüm bazlı indeksleme)
  const novelChapterRoutes = novels.flatMap((novel) =>
    (novel.chapters || []).map((chapter) => ({
      url: `${baseUrl}/novel/${novel.slug}/bolum/${chapter.chapter_number}`,
      lastModified: new Date(chapter.created_at || novel.created_at),
      changeFrequency: "weekly",
      priority: 0.6,
    }))
  );

  // Webtoon episode pages
  const webtoonEpisodeRoutes = webtoons.flatMap((webtoon) =>
    (webtoon.episodes || []).map((episode) => ({
      url: `${baseUrl}/webtoon/${webtoon.slug || webtoon.id}/bolum/${episode.id}`,
      lastModified: new Date(episode.created_at || webtoon.created_at),
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