export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://kaosmanga.net").replace(/\/$/, "");
export const PUBLIC_API = (process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api").replace(/\/$/, "");
export const INTERNAL_API = (process.env.INTERNAL_API_URL || "http://backend:8000").replace(/\/$/, "");

export function siteUrl(path = "") {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function rewriteBackendHost(value) {
  if (typeof value === "string") {
    return value.replaceAll("http://backend:8000", SITE_URL);
  }
  if (Array.isArray(value)) {
    return value.map(rewriteBackendHost);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, rewriteBackendHost(nested)])
    );
  }
  return value;
}

async function fetchJson(base, path, timeoutMs) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Docker içindeki backend'e dener; olmazsa public API'ye düşer.
 * Hata fırlatmaz — başarısızsa null döner (SSR 5xx üretmesin).
 */
export async function serverFetch(path, { timeoutMs = 5000 } = {}) {
  const bases = [...new Set([INTERNAL_API, PUBLIC_API])];
  for (const base of bases) {
    try {
      const data = await fetchJson(base, path, timeoutMs);
      return rewriteBackendHost(data);
    } catch (err) {
      console.error(`[serverFetch] ${base}${path} → ${err.message}`);
    }
  }
  return null;
}
