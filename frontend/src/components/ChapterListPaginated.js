"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { formatChapterNumber } from "@/lib/chapterTitle";

/**
 * Bölüm listesi: sayfalama + bölüm numarasına atlama.
 * type: "novel" | "webtoon"
 */
export default function ChapterListPaginated({
  items = [],
  type = "novel",
  basePath, // /novel/slug veya /webtoon/id
  perPage = 30,
  accent = "purple", // purple | blue
}) {
  const [page, setPage] = useState(1);
  const [jump, setJump] = useState("");
  const [jumpMsg, setJumpMsg] = useState("");

  const sorted = useMemo(() => {
    const copy = [...items];
    if (type === "novel") {
      copy.sort((a, b) => b.chapter_number - a.chapter_number);
    } else {
      copy.sort((a, b) => b.episode_number - a.episode_number);
    }
    return copy;
  }, [items, type]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageItems = sorted.slice((page - 1) * perPage, page * perPage);

  const themes = {
    purple: {
      border: "hover:border-purple-500/50",
      numBg: "bg-purple-900/20 text-purple-400 group-hover:bg-purple-600",
      activePage: "bg-purple-600 text-white border-purple-500",
      focus: "focus:border-purple-500",
      btn: "bg-purple-600 hover:bg-purple-500",
    },
    blue: {
      border: "hover:border-blue-500/50",
      numBg: "bg-[#121212] text-gray-400 group-hover:text-blue-500 group-hover:border-blue-500/30",
      activePage: "bg-blue-600 text-white border-blue-500",
      focus: "focus:border-blue-500",
      btn: "bg-blue-600 hover:bg-blue-500",
    },
  };
  const accentClasses = themes[accent] || themes.purple;

  const getHref = (item) => {
    if (type === "novel") return `${basePath}/bolum/${item.chapter_number}`;
    return `${basePath}/bolum/${item.id}`;
  };

  const getNumber = (item) =>
    formatChapterNumber(type === "novel" ? item.chapter_number : item.episode_number);

  const getTitle = (item) => {
    if (type === "novel") return item.title || `Bölüm ${getNumber(item)}`;
    return item.title || `Bölüm ${getNumber(item)}`;
  };

  const handleJump = (e) => {
    e.preventDefault();
    setJumpMsg("");
    const raw = jump.trim().replace(",", ".");
    if (!raw) return;
    const num = parseFloat(raw);
    if (Number.isNaN(num)) {
      setJumpMsg("Geçerli bir bölüm numarası yaz.");
      return;
    }

    // Exact match first, then closest
    let idx = sorted.findIndex((it) => Number(getNumber(it)) === num);
    if (idx === -1) {
      // find closest by absolute difference
      let best = -1;
      let bestDiff = Infinity;
      sorted.forEach((it, i) => {
        const d = Math.abs(Number(getNumber(it)) - num);
        if (d < bestDiff) {
          bestDiff = d;
          best = i;
        }
      });
      idx = best;
      if (idx === -1) {
        setJumpMsg("Bölüm bulunamadı.");
        return;
      }
      setJumpMsg(`Tam eşleşme yok, en yakın: ${getNumber(sorted[idx])}`);
    }

    const targetPage = Math.floor(idx / perPage) + 1;
    setPage(targetPage);

    // Highlight after render
    const id = `ch-item-${sorted[idx].id}`;
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", accent === "blue" ? "ring-blue-500" : "ring-purple-500");
        setTimeout(() => el.classList.remove("ring-2", "ring-blue-500", "ring-purple-500"), 2000);
      }
    }, 50);
  };

  // Pagination window: 1 2 3 ... n-1 n
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
    pages.sort((a, b) => a - b).forEach((p) => {
      if (prev && p - prev > 1) result.push("...");
      result.push(p);
      prev = p;
    });
    return result;
  }, [page, totalPages]);

  if (!items.length) {
    return (
      <div className="col-span-full text-center py-10 bg-[#1e1e1e] rounded-xl border border-dashed border-gray-800 text-gray-500">
        Henüz bölüm yüklenmemiş.
      </div>
    );
  }

  return (
    <div>
      {/* Araç çubuğu: bölüm numarası yaz */}
      <form
        onSubmit={handleJump}
        className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center bg-[#1a1a1a] border border-gray-800 rounded-xl p-3"
      >
        <label className="text-sm text-gray-400 shrink-0 px-1">Bölüme git:</label>
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            placeholder="Örn: 2478"
            className={`flex-1 min-w-0 bg-[#121212] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none ${accentClasses.focus}`}
          />
          <button
            type="submit"
            className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition shrink-0 ${accentClasses.btn}`}
          >
            Git
          </button>
        </div>
        {jumpMsg && <p className="text-xs text-gray-500 sm:ml-2">{jumpMsg}</p>}
      </form>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pageItems.map((item) => (
          <Link
            key={item.id}
            id={`ch-item-${item.id}`}
            href={getHref(item)}
            title={`${getTitle(item)} Oku`}
            className={`bg-[#1e1e1e] p-4 rounded-xl border border-gray-800 ${accentClasses.border} hover:bg-[#252525] transition-all flex items-center gap-3 group scroll-mt-24`}
          >
            <div
              className={`w-12 h-12 rounded-lg border border-gray-800 flex items-center justify-center text-sm font-bold shrink-0 transition-all ${accentClasses.numBg} group-hover:text-white`}
            >
              {getNumber(item)}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-gray-200 text-sm truncate group-hover:text-white transition">
                {type === "novel" ? getTitle(item) : `Bölüm ${getNumber(item)}`}
              </h4>
              <span className="text-xs text-gray-500">
                {item.created_at
                  ? new Date(item.created_at).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Okumak için tıkla"}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="w-9 h-9 rounded-lg bg-[#1e1e1e] border border-gray-800 text-gray-300 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Önceki sayfa"
          >
            ‹
          </button>

          {pageButtons.map((p, i) =>
            p === "..." ? (
              <span key={`e-${i}`} className="w-9 h-9 flex items-center justify-center text-gray-600 text-sm">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`min-w-9 h-9 px-2 rounded-lg border text-sm font-bold transition ${
                  page === p
                    ? accentClasses.activePage
                    : "bg-[#1e1e1e] border-gray-800 text-gray-300 hover:border-gray-600"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="w-9 h-9 rounded-lg bg-[#1e1e1e] border border-gray-800 text-gray-300 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Sonraki sayfa"
          >
            ›
          </button>

          <span className="ml-2 text-xs text-gray-500">
            Sayfa {page} / {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
