import { API } from "@/api";

// Force dynamic to avoid build-time issues
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

export default async function sitemap() {
  const baseUrl = "http://localhost:3000";
  const apiUrl = API || "http://127.0.0.1:8000";
  let novels = [];

  try {
    const res = await fetch(`${apiUrl}/novels/`, {
      cache: 'no-store'
    });
    if (res.ok) {
      novels = await res.json();
    }
  } catch (error) {
    console.error("Sitemap oluşturulurken hata:", error);
    // Build fails gracefully, returns empty array
  }

  // Static pages
  const staticRoutes = [
    "",
    "/kesfet",
    "/seriler",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1,
  }));

  // Dynamic novel pages
  const novelRoutes = novels.map((novel) => ({
    url: `${baseUrl}/novel/${novel.slug}`,
    lastModified: new Date(novel.updated_at || novel.created_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...novelRoutes];
}