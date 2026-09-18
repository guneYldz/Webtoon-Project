export default function manifest() {
  return {
    name: "Kaos Manga - Türkçe Webtoon, Manga ve Novel Oku",
    short_name: "Kaos Manga",
    description:
      "Kaos Manga'da en yeni webtoon, manga ve novelleri Türkçe ve ücretsiz oku.",
    start_url: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#2a1848",
    lang: "tr",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
