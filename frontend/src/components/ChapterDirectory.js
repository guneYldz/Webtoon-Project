"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  ArrowUpDown,
  CheckCircle2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  formatChapterNumber,
  isAutoChapterTitle,
} from "@/lib/chapterTitle";
import { useReadingHistory, isChapterRead } from "@/lib/readingHistory";
import { Badge, Button } from "@/components/ui";

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

function isRecentlyPublished(dateStr) {
  if (!dateStr) return false;
  const ts = new Date(dateStr).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= TWO_DAYS_MS;
}

/**
 * Filterable, sortable, paginated chapter directory with reading history status.
 */
export default function ChapterDirectory({
  items = [],
  type = "novel",
  seriesId,
  basePath,
  perPage = 30,
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // "desc" | "asc"

  const { hydrated, getSeriesProgress } = useReadingHistory();
  const progress = hydrated
    ? getSeriesProgress(type, seriesId ?? basePath?.split("/").pop())
    : null;

  const getRawNumber = (item) =>
    type === "novel" ? item.chapter_number : item.episode_number;

  const getNumber = (item) => formatChapterNumber(getRawNumber(item));

  const getDisplayTitle = (item) => {
    const num = getNumber(item);
    const title = String(item.title || "").trim();
    if (!title || isAutoChapterTitle(title)) {
      return `Bölüm ${num}`;
    }
    return title;
  };

  const getHref = (item) => {
    if (type === "novel") return `${basePath}/bolum/${item.chapter_number}`;
    return `${basePath}/bolum/${item.id}`;
  };

  const sortedAndFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = [...items];

    if (query) {
      list = list.filter((item) => {
        const num = String(getNumber(item)).toLowerCase();
        const title = getDisplayTitle(item).toLowerCase();
        return num.includes(query) || title.includes(query);
      });
    }

    list.sort((a, b) => {
      const na = Number(getRawNumber(a)) || 0;
      const nb = Number(getRawNumber(b)) || 0;
      return sortOrder === "asc" ? na - nb : nb - na;
    });

    return list;
  }, [items, search, sortOrder, type]);

  const totalPages = Math.max(1, Math.ceil(sortedAndFiltered.length / perPage));

  useEffect(() => {
    setPage(1);
  }, [search, sortOrder]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageItems = sortedAndFiltered.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const pageButtons = useMemo(() => {
    const pages = [];
    const add = (p) => {
      if (!pages.includes(p)) pages.push(p);
    };
    add(1);
    for (let p = page - 1; p <= page + 1; p++) {
      if (p >= 1 && p <= totalPages) add(p);
    }
    add(totalPages);

    const result = [];
    let prev = 0;
    pages
      .sort((a, b) => a - b)
      .forEach((p) => {
        if (prev && p - prev > 1) result.push("...");
        result.push(p);
        prev = p;
      });
    return result;
  }, [page, totalPages]);

  if (!items.length) {
    return (
      <div className="text-center py-12 bg-surface rounded-2xl border border-dashed border-subtle text-ink-muted text-sm">
        Henüz bölüm yüklenmemiş.
      </div>
    );
  }

  return (
    <div id="bolumler" className="scroll-mt-24">
      {/* Search + Sort Toolbar */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3 sm:items-center justify-between bg-surface border border-subtle rounded-2xl p-3">
        <div className="relative flex-1 min-w-0">
          <Search
            className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bölüm no veya başlık ara (örn: 142)..."
            aria-label="Bölüm ara"
            className="w-full h-10 bg-canvas border border-subtle rounded-xl pl-10 pr-9 text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-accent-border transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Aramayı temizle"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() =>
              setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
            }
          >
            <ArrowUpDown className="h-4 w-4 text-accent" aria-hidden="true" />
            <span>{sortOrder === "desc" ? "Yeniden Eskiye" : "Eskiden Yeniye"}</span>
          </Button>
        </div>
      </div>

      {/* Empty Search Result */}
      {sortedAndFiltered.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-2xl border border-subtle text-ink-secondary text-sm">
          &ldquo;{search}&rdquo; aramasına uygun bölüm bulunamadı.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pageItems.map((item) => {
            const num = getNumber(item);
            const rawNum = getRawNumber(item);
            const displayTitle = getDisplayTitle(item);
            const hasSubtitle =
              displayTitle.toLowerCase() !== `bölüm ${num}`.toLowerCase();
            const isRecent = isRecentlyPublished(item.created_at);

            const isCurrentLast =
              Boolean(progress) &&
              (type === "webtoon"
                ? String(progress.lastChapterId) === String(item.id)
                : String(progress.lastChapterNumber) === String(rawNum));

            const read =
              Boolean(progress) &&
              isChapterRead(
                progress,
                type === "webtoon" ? item.id : undefined,
                rawNum
              );

            return (
              <Link
                key={item.id}
                href={getHref(item)}
                title={`${displayTitle} Oku`}
                className={`group flex items-center gap-3.5 rounded-xl border p-3.5 transition-all duration-200 ease-smooth ${
                  isCurrentLast
                    ? "bg-accent-soft border-accent-border shadow-sm"
                    : read
                    ? "bg-surface/60 border-subtle opacity-75 hover:opacity-100 hover:border-hover hover:bg-surface"
                    : "bg-surface border-subtle hover:border-accent-border hover:bg-elevated"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center text-sm font-bold shrink-0 tabular-nums transition-colors ${
                    isCurrentLast
                      ? "bg-accent text-[#0B0B0F] border-transparent"
                      : read
                      ? "bg-canvas/60 border-subtle text-ink-muted"
                      : "bg-canvas border-subtle text-ink-primary group-hover:border-accent-border group-hover:text-accent"
                  }`}
                >
                  {num}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4
                      className={`font-semibold text-sm truncate transition-colors ${
                        read && !isCurrentLast
                          ? "text-ink-secondary group-hover:text-ink-primary"
                          : "text-ink-primary"
                      }`}
                    >
                      {hasSubtitle ? displayTitle : `Bölüm ${num}`}
                    </h4>
                    {isRecent && (
                      <Badge variant="new" size="sm" className="shrink-0">
                        Yeni
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-ink-muted">
                    <span>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Okumak için tıkla"}
                    </span>
                    {isCurrentLast ? (
                      <span className="inline-flex items-center gap-1 text-accent font-semibold">
                        <BookOpen className="h-3 w-3" aria-hidden="true" />
                        Son Okunan
                      </span>
                    ) : read ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400/90 font-medium">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Okundu
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Önceki sayfa"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pageButtons.map((p, i) =>
            p === "..." ? (
              <span
                key={`e-${i}`}
                className="w-9 h-9 flex items-center justify-center text-ink-muted text-sm"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`min-w-9 h-9 px-2.5 rounded-xl border text-xs font-bold transition-all ${
                  page === p
                    ? "bg-accent text-[#0B0B0F] border-transparent shadow-sm"
                    : "bg-surface border-subtle text-ink-secondary hover:border-hover hover:text-ink-primary"
                }`}
              >
                {p}
              </button>
            )
          )}

          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Sonraki sayfa"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <span className="ml-2 text-xs text-ink-muted">
            Sayfa {page} / {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
