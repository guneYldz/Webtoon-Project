import { NextResponse } from "next/server";

/**
 * Cloudflare Browser Cache TTL (sıkça 4 saat) origin'de max-age yoksa
 * HTML'e max-age=14400 basıyor. Yeni bölüm eklenince ana sayfa eski
 * "Henüz bölüm yok" halini saatlerce gösteriyor.
 * Tarayıcıya max-age=0, CDN'e kısa s-maxage veriyoruz.
 */
export function middleware() {
  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=60, stale-while-revalidate=120, must-revalidate"
  );
  response.headers.set(
    "CDN-Cache-Control",
    "public, max-age=60, stale-while-revalidate=120"
  );
  response.headers.set(
    "Cloudflare-CDN-Cache-Control",
    "public, max-age=60, stale-while-revalidate=120"
  );
  return response;
}

export const config = {
  matcher: [
    "/",
    "/seriler",
    "/kesfet",
    "/yeniler",
    "/duyurular",
    "/webtoon/:path*",
    "/novel/:path*",
  ],
};
