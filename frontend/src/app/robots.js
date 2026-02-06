export default function robots() {
    const baseUrl = "http://localhost:3000"; // Site canlıya geçince burayı güncelle!

    return {
        rules: {
            userAgent: '*', // Tüm botlar (Google, Bing, Yandex...)
            allow: '/',     // Her yere girebilirsin
            disallow: [     // Ama buralara girme:
                '/admin/',    // Admin paneli
                '/private/',  // Özel klasörler (varsa)
                '/api/',      // API rotaları
            ],
        },
        sitemap: `${baseUrl}/sitemap.xml`, // Haritamız burada, al kullan
    }
}
