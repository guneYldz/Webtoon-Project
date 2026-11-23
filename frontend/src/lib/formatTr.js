/**
 * Deterministic Turkish number & date formatters (SSR-safe across Docker UTC / Alpine Node & browsers).
 * Turkey (Europe/Istanbul) has been permanently UTC+3 without DST since 2016.
 */

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const TR_MONTHS_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

/**
 * Formats an integer with Turkish dot thousands separators deterministically
 * (never depends on host Node ICU / browser locale settings).
 */
export function formatTrNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const rounded = Math.round(num);
  const sign = rounded < 0 ? "-" : "";
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Formats an ISO/date string deterministically in UTC+3 (Europe/Istanbul),
 * e.g. "23 Kas" or "23 Kas 2026". Identical on server and client.
 */
export function formatTrShortDate(dateInput, { withYear = false } = {}) {
  if (!dateInput) return null;
  const ts = new Date(dateInput).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const tr = new Date(ts + TR_OFFSET_MS);
  const day = tr.getUTCDate();
  const month = TR_MONTHS_SHORT[tr.getUTCMonth()];
  return withYear ? `${day} ${month} ${tr.getUTCFullYear()}` : `${day} ${month}`;
}

/**
 * Computes relative Turkish time against an explicit `nowMs` timestamp.
 * ONLY call after client mount (`useEffect`) so SSR & initial hydration match 100%.
 */
export function formatRelativeTimeFromNow(dateInput, nowMs) {
  if (!dateInput) return null;
  const ts = new Date(dateInput).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const diffSec = Math.floor((nowMs - ts) / 1000);
  if (diffSec < 60) return "Az önce";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk önce`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} sa önce`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} gün önce`;
  return formatTrShortDate(dateInput);
}
