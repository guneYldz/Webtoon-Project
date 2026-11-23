export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kaosmanga.net";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/private/",
        "/api/",
        "/login",
        "/register",
        "/sifremi-unuttum",
        "/login-admin",
        "/profil",
        "/favoriler",
        "/ayarlar",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
