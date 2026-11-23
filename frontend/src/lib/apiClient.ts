/**
 * Unified API & Media Client for Kaos Manga Frontend.
 * Handles SSR (Docker internal backend with public fallback) and client requests,
 * media URL normalization, user/admin bearer credentials, automatic single-flight
 * refresh-token rotation on 401, and unified sessionStorage admin tokens.
 */

const DEFAULT_PUBLIC_API_URL = "https://kaosmanga.net/api";
const DEFAULT_INTERNAL_API_URL = "http://backend:8000";
const DEFAULT_SITE_URL = "https://kaosmanga.net";

export const PUBLIC_API_URL = (
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_PUBLIC_API_URL
).replace(/\/+$/, "");

export const INTERNAL_API_URL = (
  process.env.INTERNAL_API_URL || DEFAULT_INTERNAL_API_URL
).replace(/\/+$/, "");

/** Backward-compatible public API base URL alias */
export const API = PUBLIC_API_URL;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
).replace(/\/+$/, "");

export const ADMIN_TOKEN_KEY = "admin_token";
export const ADMIN_ROLE_KEY = "admin_role";
export const ADMIN_USER_KEY = "admin_user";
export const USER_TOKEN_KEY = "token";

export function isServer(): boolean {
  return typeof window === "undefined";
}

/**
 * Resolves the active API base URL depending on runtime environment.
 * Server components prefer `INTERNAL_API_URL` (Docker network); browsers use `PUBLIC_API_URL`.
 */
export function getApiBaseUrl(options?: { server?: boolean }): string {
  const useServer = options?.server ?? isServer();
  return useServer ? INTERNAL_API_URL : PUBLIC_API_URL;
}

export function getPublicApiBaseUrl(): string {
  return PUBLIC_API_URL;
}

const LOCAL_PUBLIC_PREFIXES = [
  "/placeholder",
  "/logo",
  "/og-image",
  "/favicon",
  "/icon",
  "/apple-icon",
];

/**
 * Normalizes backend media paths (cover_image, banner_image, avatar, episode panel URLs)
 * into browser-safe absolute URLs. Rewrites internal Docker `http://backend:8000` URLs.
 */
export function resolveMediaUrl(
  path?: string | null,
  fallback = "/placeholder.jpg"
): string {
  if (!path || typeof path !== "string") return fallback;
  const trimmed = path.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  // Rewrite Docker-internal backend origin leaked into SSR payloads
  if (trimmed.startsWith("http://backend:8000")) {
    const rest = trimmed.slice("http://backend:8000".length).replace(/^\/+/, "");
    return `${PUBLIC_API_URL}/${rest}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Preserve Next.js public folder static assets
  if (LOCAL_PUBLIC_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return trimmed;
  }

  let clean = trimmed.replace(/^\/+/, "");
  if (PUBLIC_API_URL.endsWith("/api") && clean.startsWith("api/")) {
    clean = clean.slice(4);
  }
  return `${PUBLIC_API_URL}/${clean}`;
}

/* ============================================================================
   Admin & User Token Helpers (Unified on sessionStorage for Admin)
   ============================================================================ */

export function getAdminToken(): string | null {
  if (isServer()) return null;
  try {
    return (
      window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ||
      window.sessionStorage.getItem("access_token") ||
      window.sessionStorage.getItem("token") ||
      null
    );
  } catch {
    return null;
  }
}

export function setAdminToken(
  token: string,
  meta?: { role?: string; username?: string }
): void {
  if (isServer()) return;
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    // Keep legacy sessionStorage aliases in sync for older admin pages during migration
    window.sessionStorage.setItem("access_token", token);
    window.sessionStorage.setItem("token", token);
    if (meta?.role !== undefined) {
      window.sessionStorage.setItem(ADMIN_ROLE_KEY, meta.role);
    }
    if (meta?.username !== undefined) {
      window.sessionStorage.setItem(ADMIN_USER_KEY, meta.username);
    }
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export function clearAdminToken(): void {
  if (isServer()) return;
  try {
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    window.sessionStorage.removeItem("access_token");
    window.sessionStorage.removeItem("token");
    window.sessionStorage.removeItem(ADMIN_ROLE_KEY);
    window.sessionStorage.removeItem(ADMIN_USER_KEY);
  } catch {
    // Ignore storage access failures
  }
}

export function getAdminSession(): {
  token: string | null;
  role: string | null;
  username: string | null;
} {
  if (isServer()) return { token: null, role: null, username: null };
  try {
    return {
      token: getAdminToken(),
      role: window.sessionStorage.getItem(ADMIN_ROLE_KEY),
      username: window.sessionStorage.getItem(ADMIN_USER_KEY),
    };
  } catch {
    return { token: null, role: null, username: null };
  }
}

export function isAdminAuthenticated(): boolean {
  const { token, role } = getAdminSession();
  return Boolean(token && role === "admin");
}

export function getAdminAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getUserToken(): string | null {
  if (isServer()) return null;
  try {
    return window.localStorage.getItem(USER_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/* ============================================================================
   User Refresh Token Rotation & Logout
   ============================================================================ */

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Single-flight user access-token refresh using the HttpOnly `kaos_refresh_token` cookie.
 * Updates `localStorage` and dispatches `"auth-change"` on success, or clears stale token on failure.
 */
export async function refreshUserAccessToken(): Promise<string | null> {
  if (isServer()) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${PUBLIC_API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        window.localStorage.removeItem(USER_TOKEN_KEY);
        window.localStorage.removeItem("role");
        window.localStorage.removeItem("username");
        return null;
      }

      const data = await res.json().catch(() => null);
      const newToken =
        data && typeof data === "object" && "access_token" in data
          ? String((data as { access_token?: unknown }).access_token || "")
          : "";

      if (!newToken) {
        window.localStorage.removeItem(USER_TOKEN_KEY);
        return null;
      }

      window.localStorage.setItem(USER_TOKEN_KEY, newToken);
      if (data && typeof data === "object") {
        const meta = data as {
          role?: string;
          username?: string;
          user?: { role?: string; username?: string };
        };
        const role = meta.role || meta.user?.role;
        const username = meta.username || meta.user?.username;
        if (role) window.localStorage.setItem("role", role);
        if (username) window.localStorage.setItem("username", username);
      }
      window.dispatchEvent(new Event("auth-change"));
      return newToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Revokes the server-side refresh cookie via `POST /auth/logout`, clears local user credentials,
 * and notifies all mounted components via `"auth-change"`.
 */
export async function logoutUser(): Promise<void> {
  if (isServer()) return;
  const token = getUserToken();
  try {
    await fetch(`${PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // Ignore network errors on logout
  }
  try {
    window.localStorage.removeItem(USER_TOKEN_KEY);
    window.localStorage.removeItem("role");
    window.localStorage.removeItem("username");
    window.dispatchEvent(new Event("auth-change"));
  } catch {
    // Ignore storage access errors
  }
}

/* ============================================================================
   Unified Fetch Wrapper
   ============================================================================ */

export type ApiAuthMode = "none" | "user" | "admin";

export interface ApiFetchOptions extends RequestInit {
  /** Automatically attaches Bearer token & credentials for user or admin endpoints */
  auth?: ApiAuthMode;
  /** Convenience JSON payload (automatically stringified with Content-Type: application/json) */
  json?: unknown;
  /** Override resolved base URL */
  baseUrl?: string;
  /** When running on server outside Docker, retry PUBLIC_API_URL if INTERNAL_API_URL fails */
  fallbackToPublic?: boolean;
  /** Next.js App Router fetch cache extensions */
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}

export class ApiError extends Error {
  status: number;
  detail?: string;
  data?: unknown;

  constructor(
    message: string,
    status: number,
    detail?: string,
    data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.data = data;
  }
}

function buildApiUrl(baseUrl: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function isAuthRefreshExcludedPath(path: string): boolean {
  return (
    path.includes("/auth/refresh") ||
    path.includes("/auth/giris-yap") ||
    path.includes("/auth/logout") ||
    path.includes("/auth/google")
  );
}

/**
 * Low-level unified `fetch` returning the raw `Response`.
 * Automatically handles SSR Docker -> Public fallback, JSON serialization, auth headers,
 * and single-flight user access-token refresh on 401.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const {
    auth = "none",
    json,
    baseUrl,
    fallbackToPublic = true,
    headers: rawHeaders,
    credentials,
    body,
    ...rest
  } = options;

  const headers = new Headers(rawHeaders);

  if (auth === "admin") {
    const token = getAdminToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } else if (auth === "user") {
    const token = getUserToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let requestBody = body;
  if (json !== undefined) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    requestBody = JSON.stringify(json);
  }

  const resolvedCredentials =
    credentials ?? (auth !== "none" ? "include" : undefined);

  const fetchInit: RequestInit & {
    next?: { revalidate?: number | false; tags?: string[] };
  } = {
    ...rest,
    headers,
    body: requestBody,
    ...(resolvedCredentials ? { credentials: resolvedCredentials } : {}),
  };

  const primaryBase = baseUrl ?? getApiBaseUrl();
  const primaryUrl = buildApiUrl(primaryBase, path);

  let response: Response;
  try {
    response = await fetch(primaryUrl, fetchInit);
  } catch (err) {
    const isAbsolute =
      path.startsWith("http://") || path.startsWith("https://");
    const canFallback =
      isServer() &&
      fallbackToPublic &&
      !baseUrl &&
      !isAbsolute &&
      primaryBase !== PUBLIC_API_URL;

    if (!canFallback) {
      throw err;
    }

    const fallbackUrl = buildApiUrl(PUBLIC_API_URL, path);
    response = await fetch(fallbackUrl, fetchInit);
  }

  // Client-side transparent 401 refresh & single retry for authenticated user calls
  if (
    !isServer() &&
    auth === "user" &&
    response.status === 401 &&
    !isAuthRefreshExcludedPath(path)
  ) {
    const refreshedToken = await refreshUserAccessToken();
    if (refreshedToken) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
      return fetch(primaryUrl, {
        ...fetchInit,
        headers: retryHeaders,
      });
    }
  }

  return response;
}

/**
 * Convenience JSON wrapper around `apiFetch`.
 * Throws `ApiError` with parsed `.detail` and `.status` when `!res.ok`.
 */
export async function apiJson<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const res = await apiFetch(path, options);
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let parsed: unknown = null;
  if (res.status !== 204) {
    parsed = isJson
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);
  }

  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail?: unknown }).detail ?? "")
        : undefined;
    throw new ApiError(
      detail || `API hatası (${res.status})`,
      res.status,
      detail,
      parsed
    );
  }

  return parsed as T;
}
