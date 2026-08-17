import "./globals.css"; // ENABLED: Tailwind PostCSS Build
import GoogleAnalytics from "@/components/GoogleAnalytics";
import Navbar from "@/components/Navbar"; // 1. Navbar'ı çağırdık (Import)

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#121212",
};

export const metadata = {
  metadataBase: new URL("https://kaosmanga.net"),
  title: {
    default: "Kaos Manga | Türkçe Webtoon, Manhwa ve Novel Oku",
    template: "%s | Kaos Manga",
  },
  // 140-160 karakter arası: arama sonucunda kesilmeden görünür
  description:
    "Kaos Manga'da en yeni webtoon, manhwa ve novelleri Türkçe ve ücretsiz oku. Trend seriler ve güncel bölümler her gün eklenir. Hemen okumaya başla!",
  keywords: [
    "webtoon oku",
    "novel oku",
    "türkçe webtoon",
    "türkçe novel",
    "manhwa oku",
    "manga oku",
    "web roman",
    "ücretsiz webtoon",
    "webnovel türkçe",
    "kaos manga",
  ],
  authors: [{ name: "Kaos Manga", url: "https://kaosmanga.net" }],
  publisher: "Kaos Manga",
  applicationName: "Kaos Manga",
  icons: {
    icon: [
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://kaosmanga.net",
    siteName: "Kaos Manga",
    title: "Kaos Manga | Türkçe Webtoon, Manhwa ve Novel Oku",
    description:
      "Kaos Manga'da en yeni webtoon, manhwa ve novelleri Türkçe ve ücretsiz oku. Trend seriler ve güncel bölümler her gün eklenir.",
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
    title: "Kaos Manga | Türkçe Webtoon, Manhwa ve Novel Oku",
    description:
      "Kaos Manga'da en yeni webtoon, manhwa ve novelleri Türkçe ve ücretsiz oku. Trend seriler ve güncel bölümler her gün eklenir.",
    images: ["/og-image.png"],
  },
};

import { Inter, Cinzel } from "next/font/google";

// display: "optional" -> yazi tipi gecikirse tarayici yedek fontta kalir ve
// sonradan takas yapmaz; "swap" metin kaymasina (CLS) yol aciyordu
const inter = Inter({ subsets: ["latin"], display: "optional", preload: true });
// Cinzel sadece baslik/logo yazisinda kullanildigi icin preload edilmiyor:
// ilk boyamada Inter ile yaris etmesin (FCP/LCP)
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-cinzel",
  display: "optional",
  preload: false,
  fallback: ["Georgia", "serif"],
}); // Manga/Fantasy font

// Site geneli yapılandırılmış veri (Google zengin sonuçlar için)
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://kaosmanga.net/#organization",
      name: "Kaos Manga",
      url: "https://kaosmanga.net",
      logo: {
        "@type": "ImageObject",
        url: "https://kaosmanga.net/logo.png",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://kaosmanga.net/#website",
      name: "Kaos Manga",
      alternateName: "Kaos Manga - Türkçe Webtoon ve Novel",
      url: "https://kaosmanga.net",
      inLanguage: "tr-TR",
      publisher: { "@id": "https://kaosmanga.net/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://kaosmanga.net/kesfet?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      {/* Renkler globals.css'te tanımlı; inline stil SEO araçlarında uyarı veriyordu */}
      <body className={`${inter.className} ${cinzel.variable}`}>
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
