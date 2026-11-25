import { SITE_URL } from "@/lib/apiClient";

export async function generateMetadata({ params }) {
  const raw = params?.username ? String(params.username) : "";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Keep raw if malformed percent encoding
  }
  const canonicalUrl = `${SITE_URL}/kullanici/${encodeURIComponent(decoded)}`;

  return {
    title: `${decoded} Profili`,
    description: `${decoded} kullanıcısının Kaos Manga profili, yorumları ve favori serileri.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function KullaniciLayout({ children }) {
  return children;
}
