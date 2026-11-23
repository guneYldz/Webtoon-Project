import "./globals.css";
import { Inter, Cinzel, Lora } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const HAS_GOOGLE_AUTH = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B0B0F",
};

export const metadata = {
  metadataBase: new URL("https://kaosmanga.net"),
  title: {
    default: "Kaos Manga | Türkçe Webtoon, Manga ve Novel Oku",
    template: "%s | Kaos Manga",
  },
  description:
    "Kaos Manga'da en yeni webtoon, manga ve novelleri Türkçe ve ücretsiz oku. Manhwa ve web novel arşivi her gün güncellenir. Hemen okumaya başla!",
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
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://kaosmanga.net",
    siteName: "Kaos Manga",
    title: "Kaos Manga | Türkçe Webtoon, Manga ve Novel Oku",
    description:
      "Kaos Manga'da en yeni webtoon, manga ve novelleri Türkçe ve ücretsiz oku. Manhwa ve web novel arşivi her gün güncellenir.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kaos Manga - Webtoon, Manga ve Novel Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@kaosmanga",
    title: "Kaos Manga | Türkçe Webtoon, Manga ve Novel Oku",
    description:
      "Kaos Manga'da en yeni webtoon, manga ve novelleri Türkçe ve ücretsiz oku. Manhwa ve web novel arşivi her gün güncellenir.",
    images: ["/og-image.png"],
  },
};

// Strict 3-font budget — ALL with "latin-ext" for Turkish characters (ğ, ş, ı, İ, ö, ü, ç)
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const cinzel = Cinzel({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "900"],
  variable: "--font-cinzel",
  display: "swap",
  preload: false,
  fallback: ["Georgia", "serif"],
});

const lora = Lora({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
  preload: false,
  fallback: ["Georgia", "serif"],
});

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
      alternateName: [
        "Kaos Manga - Türkçe Webtoon, Manga ve Novel",
        "Kaos Manga - En İyi Webtoon, Manga ve Novelleri Türkçe Oku",
      ],
      description:
        "Türkçe webtoon, manga ve novel oku. En yeni bölümler Kaos Manga'da ücretsiz.",
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
    <html
      lang="tr"
      className={`${inter.variable} ${cinzel.variable} ${lora.variable} dark`}
    >
      <head>
        {HAS_GOOGLE_AUTH && (
          <>
            <link rel="preconnect" href="https://accounts.google.com" />
            <link rel="dns-prefetch" href="https://accounts.google.com" />
          </>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body className="font-sans bg-canvas text-ink-primary antialiased selection:bg-brand/30 selection:text-white">
        <GoogleAnalytics gaId="G-JQ0YHH7PL5" />
        {HAS_GOOGLE_AUTH && (
          <Script
            id="google-identity-services-sdk"
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
          />
        )}
        {children}
        <Toaster
          richColors
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "!bg-elevated !border !border-white/10 !text-ink-primary !shadow-2xl",
            },
          }}
        />
      </body>
    </html>
  );
}
