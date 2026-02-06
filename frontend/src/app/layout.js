// import "./globals.css"; // DISABLED: CSS loader broken in Docker, using CDN instead
import GoogleAnalytics from "@/components/GoogleAnalytics";
import Navbar from "@/components/Navbar"; // 1. Navbar'ı çağırdık (Import)

export const metadata = {
  title: {
    default: "Webtoon & Novel Dünyası",
    template: "%s | Site Adın", // Alt sayfalarda "Shadow Slave | Site Adın" yazar
  },
  description: "En sevilen Webtoon ve Novelleri Türkçe ve ücretsiz oku.",
  keywords: ["webtoon", "novel", "türkçe manga", "shadow slave oku", "oku"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        {/* Swiper CSS CDN - Fix for Docker Build Error */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css" />
      </head>
      <body style={{ backgroundColor: '#121212', color: '#e0e0e0' }}>
        <GoogleAnalytics gaId="G-JQ0YHH7PL5" />
        {/* 2. Navbar'ı en tepeye koyduk */}
        <Navbar />

        {/* 3. Sayfanın geri kalanı (Çocuklar) buraya gelecek */}
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
