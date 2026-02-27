import "./globals.css"; // ENABLED: Tailwind PostCSS Build
import GoogleAnalytics from "@/components/GoogleAnalytics";
import Navbar from "@/components/Navbar"; // 1. Navbar'ı çağırdık (Import)

export const metadata = {
  metadataBase: new URL("https://kaosmanga.net"),
  title: {
    default: "Kaos Manga | Webtoon ve Novel Oku",
    template: "%s | Kaos Manga",
  },
  description:
    "Kaos Manga ile en sevilen Webtoon ve Novelleri Türkçe ve tamamen ücretsiz oku. En yeni bölümler, trend seriler ve popüler romanlar seni bekliyor. Hemen keşfet!",
  authors: [{ name: "Kaos Manga", url: "https://kaosmanga.net" }],
  publisher: "Kaos Manga",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://kaosmanga.net",
    siteName: "Kaos Manga",
    title: "Kaos Manga | Webtoon ve Novel Oku",
    description:
      "Kaos Manga ile en sevilen Webtoon ve Novelleri Türkçe ve tamamen ücretsiz oku. En yeni bölümler, trend seriler ve popüler romanlar seni bekliyor.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kaos Manga - Webtoon ve Novel Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@kaosmanga",
    title: "Kaos Manga | Webtoon ve Novel Oku",
    description:
      "Kaos Manga ile en sevilen Webtoon ve Novelleri Türkçe ve tamamen ücretsiz oku. En yeni bölümler, trend seriler ve popüler romanlar seni bekliyor.",
    images: ["/og-image.png"],
  },
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
