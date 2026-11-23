"use client";

import { useCallback, useEffect, useState } from "react";

export const READING_HISTORY_STORAGE_KEY = "kaos_reading_history_v1";
export const READING_HISTORY_EVENT = "reading-history-updated";
export const MAX_READING_HISTORY_ENTRIES = 30;

export type ReadingContentType = "webtoon" | "novel";
export type ReadingSeriesType = "WEBTOON" | "MANGA" | "NOVEL";

export interface ReadingHistoryEntry {
  type: ReadingContentType;
  seriesType: ReadingSeriesType;
  seriesId: number | string;
  slug: string;
  title: string;
  coverImage: string;
  lastChapterId?: number | string;
  lastChapterNumber: number | string;
  lastChapterTitle?: string;
  lastChapterUrl: string;
  scrollPct: number;
  readChapterIds: (number | string)[];
  updatedAt: number;
}

export interface RecordChapterReadInput {
  type: ReadingContentType;
  seriesType?: ReadingSeriesType | string;
  seriesId: number | string;
  slug?: string;
  title: string;
  coverImage?: string;
  lastChapterId?: number | string;
  lastChapterNumber: number | string;
  lastChapterTitle?: string;
  lastChapterUrl?: string;
  scrollPct?: number;
  /** Optional explicit chapter identifier to mark as read in `readChapterIds` */
  chapterKey?: number | string;
}

type ReadingHistoryStore = Record<string, ReadingHistoryEntry>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function makeReadingHistoryKey(
  type: ReadingContentType,
  seriesId: number | string
): string {
  return `${type}:${String(seriesId)}`;
}

function normalizeSeriesType(
  type: ReadingContentType,
  raw?: string
): ReadingSeriesType {
  const upper = String(raw || "").toUpperCase();
  if (upper.includes("NOVEL")) return "NOVEL";
  if (upper.includes("MANGA")) return "MANGA";
  if (upper.includes("WEBTOON")) return "WEBTOON";
  return type === "novel" ? "NOVEL" : "WEBTOON";
}

function clampScrollPct(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)));
}

function buildDefaultChapterUrl(input: RecordChapterReadInput): string {
  const slugOrId = input.slug || String(input.seriesId);
  if (input.type === "novel") {
    return `/novel/${slugOrId}/bolum/${input.lastChapterNumber}`;
  }
  const episodeSeg = input.lastChapterId ?? input.lastChapterNumber;
  return `/webtoon/${slugOrId}/bolum/${episodeSeg}`;
}

function mergeReadChapterIds(
  existing: (number | string)[] | undefined,
  additions: (number | string | undefined)[]
): (number | string)[] {
  const seen = new Set<string>();
  const result: (number | string)[] = [];

  for (const id of existing || []) {
    if (id === undefined || id === null || id === "") continue;
    const key = String(id);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(id);
    }
  }

  for (const id of additions) {
    if (id === undefined || id === null || id === "") continue;
    const key = String(id);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(id);
    }
  }

  return result;
}

function readStore(): ReadingHistoryStore {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(READING_HISTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const store: ReadingHistoryStore = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (!val || typeof val !== "object") continue;
      const entry = val as Partial<ReadingHistoryEntry>;
      if (
        (entry.type !== "webtoon" && entry.type !== "novel") ||
        entry.seriesId === undefined ||
        entry.seriesId === null
      ) {
        continue;
      }
      store[key] = {
        type: entry.type,
        seriesType: normalizeSeriesType(entry.type, entry.seriesType),
        seriesId: entry.seriesId,
        slug: String(entry.slug || ""),
        title: String(entry.title || ""),
        coverImage: String(entry.coverImage || ""),
        lastChapterId: entry.lastChapterId,
        lastChapterNumber: entry.lastChapterNumber ?? "",
        lastChapterTitle: entry.lastChapterTitle,
        lastChapterUrl: String(entry.lastChapterUrl || ""),
        scrollPct: clampScrollPct(entry.scrollPct),
        readChapterIds: Array.isArray(entry.readChapterIds)
          ? entry.readChapterIds
          : [],
        updatedAt:
          typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
            ? entry.updatedAt
            : 0,
      };
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: ReadingHistoryStore): void {
  if (!isBrowser()) return;
  try {
    // Keep at most MAX_READING_HISTORY_ENTRIES sorted by updatedAt descending
    const sortedEntries = Object.entries(store)
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_READING_HISTORY_ENTRIES);

    const pruned: ReadingHistoryStore = {};
    for (const [key, entry] of sortedEntries) {
      pruned[key] = entry;
    }

    window.localStorage.setItem(
      READING_HISTORY_STORAGE_KEY,
      JSON.stringify(pruned)
    );
    window.dispatchEvent(new CustomEvent(READING_HISTORY_EVENT));
  } catch {
    // Ignore private mode / quota errors
  }
}

/**
 * Records a chapter visit in reading history, creating or updating the series entry
 * and marking the chapter identifier in `readChapterIds`.
 */
export function recordChapterRead(
  input: RecordChapterReadInput
): ReadingHistoryEntry | null {
  if (!isBrowser()) return null;
  if (!input || input.seriesId === undefined || input.seriesId === null) {
    return null;
  }

  const store = readStore();
  const key = makeReadingHistoryKey(input.type, input.seriesId);
  const prev = store[key];

  const primaryChapterId =
    input.chapterKey !== undefined
      ? input.chapterKey
      : input.lastChapterId !== undefined
      ? input.lastChapterId
      : input.lastChapterNumber;

  const isSameChapter =
    prev &&
    (input.lastChapterId !== undefined && prev.lastChapterId !== undefined
      ? String(prev.lastChapterId) === String(input.lastChapterId)
      : String(prev.lastChapterNumber) === String(input.lastChapterNumber));

  const nextEntry: ReadingHistoryEntry = {
    type: input.type,
    seriesType: normalizeSeriesType(
      input.type,
      input.seriesType ?? prev?.seriesType
    ),
    seriesId: input.seriesId,
    slug: input.slug ?? prev?.slug ?? "",
    title: input.title || prev?.title || "",
    coverImage: input.coverImage ?? prev?.coverImage ?? "",
    lastChapterId: input.lastChapterId ?? (isSameChapter ? prev?.lastChapterId : undefined),
    lastChapterNumber: input.lastChapterNumber,
    lastChapterTitle:
      input.lastChapterTitle ?? (isSameChapter ? prev?.lastChapterTitle : undefined),
    lastChapterUrl: input.lastChapterUrl || buildDefaultChapterUrl(input),
    scrollPct:
      input.scrollPct !== undefined
        ? clampScrollPct(input.scrollPct)
        : isSameChapter
        ? prev.scrollPct
        : 0,
    readChapterIds: mergeReadChapterIds(prev?.readChapterIds, [
      primaryChapterId,
    ]),
    updatedAt: Date.now(),
  };

  store[key] = nextEntry;
  writeStore(store);
  return nextEntry;
}

/**
 * Updates scroll progress (0–100) for an existing reading history entry.
 * Skips redundant storage writes if the rounded percentage did not change.
 */
export function updateScrollProgress(
  type: ReadingContentType,
  seriesId: number | string,
  scrollPct: number,
  options?: {
    lastChapterId?: number | string;
    lastChapterNumber?: number | string;
    lastChapterUrl?: string;
  }
): ReadingHistoryEntry | null {
  if (!isBrowser()) return null;
  const store = readStore();
  const key = makeReadingHistoryKey(type, seriesId);
  const existing = store[key];
  if (!existing) return null;

  const clamped = clampScrollPct(scrollPct);
  const chapterChanged =
    (options?.lastChapterId !== undefined &&
      String(options.lastChapterId) !== String(existing.lastChapterId)) ||
    (options?.lastChapterNumber !== undefined &&
      String(options.lastChapterNumber) !== String(existing.lastChapterNumber));

  if (clamped === existing.scrollPct && !chapterChanged) {
    return existing;
  }

  const updated: ReadingHistoryEntry = {
    ...existing,
    scrollPct: clamped,
    ...(options?.lastChapterId !== undefined
      ? { lastChapterId: options.lastChapterId }
      : {}),
    ...(options?.lastChapterNumber !== undefined
      ? { lastChapterNumber: options.lastChapterNumber }
      : {}),
    ...(options?.lastChapterUrl !== undefined
      ? { lastChapterUrl: options.lastChapterUrl }
      : {}),
    updatedAt: Date.now(),
  };

  store[key] = updated;
  writeStore(store);
  return updated;
}

/**
 * Returns reading progress for a single series by `${type}:${seriesId}`.
 * Also matches by `slug` as a fallback when `seriesId` is a slug string.
 */
export function getSeriesProgress(
  type: ReadingContentType,
  seriesId: number | string
): ReadingHistoryEntry | null {
  if (!isBrowser()) return null;
  const store = readStore();
  const direct = store[makeReadingHistoryKey(type, seriesId)];
  if (direct) return direct;

  const target = String(seriesId);
  for (const entry of Object.values(store)) {
    if (entry.type === type && entry.slug && entry.slug === target) {
      return entry;
    }
  }
  return null;
}

/**
 * Returns all reading history entries sorted by `updatedAt` descending (max 30).
 */
export function getAllReadingHistory(): ReadingHistoryEntry[] {
  if (!isBrowser()) return [];
  const store = readStore();
  return Object.values(store)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_READING_HISTORY_ENTRIES);
}

/**
 * Removes a single series from reading history.
 */
export function removeSeriesProgress(
  type: ReadingContentType,
  seriesId: number | string
): void {
  if (!isBrowser()) return;
  const store = readStore();
  const key = makeReadingHistoryKey(type, seriesId);
  if (key in store) {
    delete store[key];
    writeStore(store);
    return;
  }

  // Fallback match by slug
  const target = String(seriesId);
  let removed = false;
  for (const [k, entry] of Object.entries(store)) {
    if (entry.type === type && entry.slug === target) {
      delete store[k];
      removed = true;
    }
  }
  if (removed) writeStore(store);
}

/**
 * Clears all stored reading history entries.
 */
export function clearReadingHistory(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(READING_HISTORY_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(READING_HISTORY_EVENT));
  } catch {
    // Ignore storage access failures
  }
}

/**
 * Utility helper to check whether a chapter id or number exists in `entry.readChapterIds`.
 */
export function isChapterRead(
  entry: ReadingHistoryEntry | null | undefined,
  chapterId?: number | string,
  chapterNumber?: number | string
): boolean {
  if (!entry || !Array.isArray(entry.readChapterIds)) return false;
  const idStr = chapterId !== undefined && chapterId !== null ? String(chapterId) : null;
  const numStr =
    chapterNumber !== undefined && chapterNumber !== null
      ? String(chapterNumber)
      : null;

  return entry.readChapterIds.some((readId) => {
    const readStr = String(readId);
    return (idStr !== null && readStr === idStr) || (numStr !== null && readStr === numStr);
  });
}

export interface UseReadingHistoryReturn {
  items: ReadingHistoryEntry[];
  hydrated: boolean;
  recordChapterRead: typeof recordChapterRead;
  updateScrollProgress: typeof updateScrollProgress;
  getSeriesProgress: (
    type: ReadingContentType,
    seriesId: number | string
  ) => ReadingHistoryEntry | null;
  removeSeriesProgress: typeof removeSeriesProgress;
  clearReadingHistory: typeof clearReadingHistory;
}

/**
 * SSR-safe React hook for reading history.
 * Always initializes empty before mount to prevent hydration mismatches,
 * hydrates in `useEffect`, and stays synced across components & browser tabs.
 */
export function useReadingHistory(): UseReadingHistoryReturn {
  const [items, setItems] = useState<ReadingHistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const sync = useCallback(() => {
    setItems(getAllReadingHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    sync();

    const handleCustomEvent = () => sync();
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === null || e.key === READING_HISTORY_STORAGE_KEY) {
        sync();
      }
    };

    window.addEventListener(READING_HISTORY_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(READING_HISTORY_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [sync]);

  const getFromState = useCallback(
    (type: ReadingContentType, seriesId: number | string) => {
      const target = String(seriesId);
      return (
        items.find(
          (entry) =>
            entry.type === type &&
            (String(entry.seriesId) === target ||
              (entry.slug && entry.slug === target))
        ) || null
      );
    },
    [items]
  );

  return {
    items,
    hydrated,
    recordChapterRead,
    updateScrollProgress,
    getSeriesProgress: getFromState,
    removeSeriesProgress,
    clearReadingHistory,
  };
}
