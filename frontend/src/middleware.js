import { NextResponse } from "next/server";

/**
 * Cloudflare Browser Cache TTL origin'de max-age yoksa HTML'e 4 saat basıyor.
 * Next.js statik sayfalara s-maxage=1 yıl koyuyor. Admin menüsü bu yüzden
 * bazen yeni, bazen eski görünüyordu.
 */
function applyPublicCache(response) {
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

function applyPrivateNoStore(response) {
  const noStore = "private, no-store, no-cache, max-age=0, must-revalidate";
  response.headers.set("Cache-Control", noStore);
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export function middleware(request) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;
  const isPrivate =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/login-admin" ||
    pathname.startsWith("/login-admin/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/profil" ||
    pathname.startsWith("/profil/") ||
    pathname === "/ayarlar" ||
    pathname.startsWith("/ayarlar/") ||
    pathname === "/favoriler" ||
    pathname.startsWith("/favoriler/") ||
    pathname === "/sifremi-unuttum";

  if (isPrivate) {
    return applyPrivateNoStore(response);
  }
  return applyPublicCache(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/|static/).*)",
  ],
};
