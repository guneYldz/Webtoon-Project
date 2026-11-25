"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, getUserToken } from "@/lib/apiClient";

export const READING_HISTORY_STORAGE_KEY = "kaos_reading_history_v1";
export const READING_HISTORY_EVENT = "reading-history-updated";
export const MAX_READING_HISTORY_ENTRIES = 30;
const MAX_READ_CHAPTER_IDS = 500;
const SCROLL_SYNC_DEBOUNCE_MS = 12000;

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

let lastSyncedAuthToken: string | null = null;
let initialSyncInFlight: Promise<void> | null = null;
const pendingScrollEntries: Map<string, ReadingHistoryEntry> = new Map();
let scrollSyncTimer: ReturnType<typeof setTimeout> | null = null;

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
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

  if (result.length > MAX_READ_CHAPTER_IDS) {
    return result.slice(result.length - MAX_READ_CHAPTER_IDS);
  }
  return result;
}

function sanitizeEntry(raw: Partial<ReadingHistoryEntry>): ReadingHistoryEntry | null {
  if (
    !raw ||
    (raw.type !== "webtoon" && raw.type !== "novel") ||
    raw.seriesId === undefined ||
    raw.seriesId === null
  ) {
    return null;
  }

  return {
    type: raw.type,
    seriesType: normalizeSeriesType(raw.type, raw.seriesType),
    seriesId: raw.seriesId,
    slug: String(raw.slug || ""),
    title: String(raw.title || ""),
    coverImage: String(raw.coverImage || ""),
    lastChapterId:
      raw.lastChapterId !== undefined && raw.lastChapterId !== null
        ? raw.lastChapterId
        : undefined,
    lastChapterNumber: raw.lastChapterNumber ?? "",
    lastChapterTitle:
      raw.lastChapterTitle !== undefined && raw.lastChapterTitle !== null
        ? String(raw.lastChapterTitle)
        : undefined,
    lastChapterUrl: String(raw.lastChapterUrl || ""),
    scrollPct: clampScrollPct(raw.scrollPct),
    readChapterIds: mergeReadChapterIds(
      Array.isArray(raw.readChapterIds) ? raw.readChapterIds : [],
      []
    ),
    updatedAt:
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : 0,
  };
}

function mergeTwoEntries(
  a: ReadingHistoryEntry,
  b: ReadingHistoryEntry
): ReadingHistoryEntry {
  const newer = (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a;
  const older = newer === b ? a : b;
  const mergedReadIds = mergeReadChapterIds(
    older.readChapterIds,
    newer.readChapterIds
  );

  return {
    type: newer.type,
    seriesType: normalizeSeriesType(
      newer.type,
      newer.seriesType || older.seriesType
    ),
    seriesId: newer.seriesId,
    slug: newer.slug || older.slug || "",
    title: newer.title || older.title || "",
    coverImage: newer.coverImage || older.coverImage || "",
    lastChapterId: newer.lastChapterId ?? older.lastChapterId,
    lastChapterNumber:
      newer.lastChapterNumber !== "" && newer.lastChapterNumber !== undefined
        ? newer.lastChapterNumber
        : older.lastChapterNumber,
    lastChapterTitle: newer.lastChapterTitle ?? older.lastChapterTitle,
    lastChapterUrl: newer.lastChapterUrl || older.lastChapterUrl || "",
    scrollPct: clampScrollPct(newer.scrollPct),
    readChapterIds: mergedReadIds,
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
  };
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
      const clean = sanitizeEntry(val as Partial<ReadingHistoryEntry>);
      if (!clean) continue;
      store[key] = clean;
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: ReadingHistoryStore): void {
  if (!isBrowser()) return;
  try {
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

async function pushEntriesToServer(entries: ReadingHistoryEntry[]): Promise<void> {
  if (!isBrowser() || entries.length === 0) return;
  const token = getUserToken();
  if (!token) return;

  try {
    const res = await apiFetch("/reading-progress/sync", {
      method: "POST",
      auth: "user",
      json: { items: entries },
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      const store = readStore();
      let changed = false;
      for (const rawItem of data.items) {
        const remote = sanitizeEntry(rawItem);
        if (!remote) continue;
        const key = makeReadingHistoryKey(remote.type, remote.seriesId);
        const local = store[key];
        if (!local) {
          store[key] = remote;
          changed = true;
        } else {
          const merged = mergeTwoEntries(local, remote);
          if (
            merged.updatedAt > local.updatedAt ||
            merged.readChapterIds.length > local.readChapterIds.length
          ) {
            store[key] = merged;
            changed = true;
          }
        }
      }
      if (changed) {
        writeStore(store);
      }
    }
  } catch {
    // Silent fire-and-forget on network error
  }
}

function scheduleDebouncedScrollSync(entry: ReadingHistoryEntry): void {
  if (!isBrowser() || !getUserToken()) return;
  const key = makeReadingHistoryKey(entry.type, entry.seriesId);
  pendingScrollEntries.set(key, entry);

  if (scrollSyncTimer) return;
  scrollSyncTimer = setTimeout(() => {
    scrollSyncTimer = null;
    const batch = Array.from(pendingScrollEntries.values());
    pendingScrollEntries.clear();
    if (batch.length > 0) {
      void pushEntriesToServer(batch);
    }
  }, SCROLL_SYNC_DEBOUNCE_MS);
}

/**
 * Fetches server reading progress when logged in, merges with local storage,
 * and pushes any local-only or newer local entries once per session/login.
 */
export async function syncReadingHistoryWithServer(force = false): Promise<void> {
  if (!isBrowser()) return;
  const token = getUserToken();
  if (!token) {
    lastSyncedAuthToken = null;
    return;
  }

  if (!force && lastSyncedAuthToken === token) {
    return;
  }
  if (initialSyncInFlight) {
    return initialSyncInFlight;
  }

  initialSyncInFlight = (async () => {
    try {
      const res = await apiFetch("/reading-progress", {
        method: "GET",
        auth: "user",
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = await res.json().catch(() => null);
      const remoteList: unknown[] = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];

      const localStore = readStore();
      const remoteMap: ReadingHistoryStore = {};

      for (const rawItem of remoteList) {
        const clean = sanitizeEntry(rawItem as Partial<ReadingHistoryEntry>);
        if (!clean) continue;
        const key = makeReadingHistoryKey(clean.type, clean.seriesId);
        remoteMap[key] = clean;
      }

      const mergedStore: ReadingHistoryStore = { ...localStore };
      let shouldUpdateLocal = false;
      const entriesToPush: ReadingHistoryEntry[] = [];

      // Merge remote into local
      for (const [key, remoteEntry] of Object.entries(remoteMap)) {
        const localEntry = mergedStore[key];
        if (!localEntry) {
          mergedStore[key] = remoteEntry;
          shouldUpdateLocal = true;
        } else {
          const merged = mergeTwoEntries(localEntry, remoteEntry);
          mergedStore[key] = merged;
          if (
            merged.updatedAt !== localEntry.updatedAt ||
            merged.readChapterIds.length !== localEntry.readChapterIds.length ||
            merged.scrollPct !== localEntry.scrollPct
          ) {
            shouldUpdateLocal = true;
          }
          if (
            localEntry.updatedAt > remoteEntry.updatedAt ||
            merged.readChapterIds.length > remoteEntry.readChapterIds.length
          ) {
            entriesToPush.push(merged);
          }
        }
      }

      // Find local-only entries to push to server
      for (const [key, localEntry] of Object.entries(localStore)) {
        if (!remoteMap[key]) {
          entriesToPush.push(localEntry);
        }
      }

      if (shouldUpdateLocal) {
        writeStore(mergedStore);
      }

      lastSyncedAuthToken = token;

      if (entriesToPush.length > 0) {
        await pushEntriesToServer(entriesToPush);
      }
    } catch {
      // Ignore offline/unauthenticated errors
    } finally {
      initialSyncInFlight = null;
    }
  })();

  return initialSyncInFlight;
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
    lastChapterId:
      input.lastChapterId ?? (isSameChapter ? prev?.lastChapterId : undefined),
    lastChapterNumber: input.lastChapterNumber,
    lastChapterTitle:
      input.lastChapterTitle ??
      (isSameChapter ? prev?.lastChapterTitle : undefined),
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

  if (getUserToken()) {
    void pushEntriesToServer([nextEntry]);
  }

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
  scheduleDebouncedScrollSync(updated);
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
  let removedSeriesId: number | string = seriesId;

  if (key in store) {
    removedSeriesId = store[key].seriesId;
    delete store[key];
    writeStore(store);
  } else {
    const target = String(seriesId);
    let removed = false;
    for (const [k, entry] of Object.entries(store)) {
      if (entry.type === type && entry.slug === target) {
        removedSeriesId = entry.seriesId;
        delete store[k];
        removed = true;
      }
    }
    if (removed) writeStore(store);
  }

  pendingScrollEntries.delete(makeReadingHistoryKey(type, removedSeriesId));

  if (getUserToken()) {
    void apiFetch(
      `/reading-progress/${type}/${encodeURIComponent(String(removedSeriesId))}`,
      {
        method: "DELETE",
        auth: "user",
      }
    ).catch(() => {});
  }
}

/**
 * Clears all stored reading history entries.
 */
export function clearReadingHistory(): void {
  if (!isBrowser()) return;
  try {
    pendingScrollEntries.clear();
    window.localStorage.removeItem(READING_HISTORY_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(READING_HISTORY_EVENT));
  } catch {
    // Ignore storage access failures
  }

  if (getUserToken()) {
    void apiFetch("/reading-progress", {
      method: "DELETE",
      auth: "user",
    }).catch(() => {});
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
  const idStr =
    chapterId !== undefined && chapterId !== null ? String(chapterId) : null;
  const numStr =
    chapterNumber !== undefined && chapterNumber !== null
      ? String(chapterNumber)
      : null;

  return entry.readChapterIds.some((readId) => {
    const readStr = String(readId);
    return (
      (idStr !== null && readStr === idStr) ||
      (numStr !== null && readStr === numStr)
    );
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
 * hydrates in `useEffect`, and stays synced across components, tabs & server.
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
    void syncReadingHistoryWithServer(false);

    const handleCustomEvent = () => sync();
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === null || e.key === READING_HISTORY_STORAGE_KEY) {
        sync();
      }
    };
    const handleAuthChange = () => {
      void syncReadingHistoryWithServer(true);
    };

    window.addEventListener(READING_HISTORY_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("auth-change", handleAuthChange);

    return () => {
      window.removeEventListener(READING_HISTORY_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("auth-change", handleAuthChange);
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
