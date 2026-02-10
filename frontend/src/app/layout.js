import "./globals.css"; // ENABLED: Tailwind PostCSS Build
import GoogleAnalytics from "@/components/GoogleAnalytics";
import Navbar from "@/components/Navbar"; // 1. Navbar'ı çağırdık (Import)

export const metadata = {
  title: {
    default: "Kaos Manga | Webtoon ve Novel Oku",
    template: "%s | Kaos Manga",
  },
  description: "Kaos Manga ile en sevilen Webtoon ve Novelleri Türkçe ve ücretsiz oku.",
  keywords: ["kaos manga", "webtoon", "novel", "türkçe manga", "shadow slave oku", "oku"],
};

import { Inter, Cinzel } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "optional", preload: true });
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel",
  display: "optional",
  preload: true
}); // Manga/Fantasy font

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        {/* Swiper CSS CDN - Fix for Docker Build Error */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css" />
      </head>
      <body style={{ backgroundColor: '#121212', color: '#e0e0e0' }} className={`${inter.className} ${cinzel.variable}`}>
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
