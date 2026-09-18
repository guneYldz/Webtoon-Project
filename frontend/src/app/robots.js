export default function robots() {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kaosmanga.net";

    return {
        rules: {
            userAgent: '*', // Tüm botlar (Google, Bing, Yandex...)
            allow: '/',     // Her yere girebilirsin
            disallow: [
                '/admin/',
                '/login-admin',
                '/private/',
                '/api/',
            ],
        },
        sitemap: `${baseUrl}/sitemap.xml`, // Haritamız burada, al kullan
    }
}
