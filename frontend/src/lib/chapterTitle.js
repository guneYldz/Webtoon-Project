export function formatChapterNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n ?? "").trim();
  if (Number.isInteger(num)) return String(num);
  return String(num);
}

export function isAutoChapterTitle(text) {
  return /^Bölüm\s+[\d.]+$/i.test(String(text || "").trim());
}

export function defaultChapterTitle(raw, number) {
  const n = formatChapterNumber(number);
  const expected = `Bölüm ${n}`;
  const text = String(raw || "").trim();
  if (!text) return expected;
  if (/^#?\s*\d+(\.\d+)?$/.test(text)) return expected;
  return text;
}
