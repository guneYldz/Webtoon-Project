"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Compass,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import SeriesCard, { SeriesCardSkeleton } from "@/components/SeriesCard";
import { Button } from "@/components/ui";

const TYPE_OPTIONS = [
  { value: "Hepsi", label: "Tümü" },
  { value: "WEBTOON", label: "Webtoon" },
  { value: "MANGA", label: "Manga" },
  { value: "NOVEL", label: "Novel" },
];

const STATUS_OPTIONS = [
  { value: "Tümü", label: "Tüm Durumlar" },
  { value: "ongoing", label: "Güncel" },
  { value: "completed", label: "Tamamlandı" },
];

const SORT_OPTIONS = [
  { value: "updated", label: "Son Güncellenen" },
  { value: "popular", label: "En Çok Okunan" },
  { value: "newest", label: "Yeni Eklenen" },
  { value: "az", label: "A'dan Z'ye" },
];

function getLatestTimestamp(item) {
  const chapters = item.episodes || item.chapters || [];
  if (Array.isArray(chapters) && chapters.length > 0) {
    const dates = chapters
      .map((c) => new Date(c.created_at || 0).getTime())
      .filter((t) => Number.isFinite(t) && t > 0);
    if (dates.length > 0) return Math.max(...dates);
  }
  return new Date(item.updated_at || item.created_at || 0).getTime() || 0;
}

function buildCatalogData(webtoons = [], novels = [], rawCategories = []) {
  const catMap = new Map();
  const catList = Array.isArray(rawCategories)
    ? rawCategories
    : rawCategories?.data || [];

  catList.forEach((c) => {
    if (!c?.name) return;
    catMap.set(c.name.toLowerCase(), {
      id: c.id,
      name: c.name,
      slug: c.slug || "",
    });
  });

  const combined = [
    ...(Array.isArray(webtoons) ? webtoons : []).map((w) => {
      const isManga = String(w.type || "WEBTOON")
        .toUpperCase()
        .includes("MANGA");
      return {
        ...w,
        type: isManga ? "MANGA" : "WEBTOON",
        typeLabel: isManga ? "MANGA" : "WEBTOON",
        link: `/webtoon/${w.slug || w.id}`,
      };
    }),
    ...(Array.isArray(novels) ? novels : []).map((n) => ({
      ...n,
      type: "NOVEL",
      typeLabel: "NOVEL",
      link: `/novel/${n.slug || n.id}`,
    })),
  ];

  combined.forEach((item) => {
    (item.categories || []).forEach((c) => {
      const name = typeof c === "string" ? c : c?.name;
      if (!name) return;
      const key = name.toLowerCase();
      if (!catMap.has(key)) {
        catMap.set(key, {
          id: typeof c === "object" ? c.id : undefined,
          name,
          slug: typeof c === "object" ? c.slug || "" : "",
        });
      }
    });
  });

  const resolvedCategories = Array.from(catMap.values());
  const chips = ["Tümü", ...resolvedCategories.map((c) => c.name)];

  return {
    combined,
    resolvedCategories,
    chips,
  };
}

function resolveCanonicalGenre(rawVal, categories) {
  const trimmed = String(rawVal || "").trim();
  if (!trimmed || trimmed.toLowerCase() === "tümü") return "Tümü";
  const lower = trimmed.toLowerCase();
  const match = (categories || []).find(
    (c) =>
      (c.id !== undefined && c.id !== null && String(c.id) === trimmed) ||
      (c.slug && String(c.slug).toLowerCase() === lower) ||
      (c.name && String(c.name).toLowerCase() === lower)
  );
  return match ? match.name : trimmed;
}

/**
 * Isolated query-param sync boundary so `KesfetClient` does NOT call `useSearchParams()`
 * directly — preserving full static SSR/ISR HTML for Googlebot on first paint!
 */
function KesfetQuerySync({
  categoryList,
  loading,
  debouncedQuery,
  selectedType,
  selectedGenre,
  selectedStatus,
  sortBy,
  onSyncFromUrl,
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [urlHydrated, setUrlHydrated] = useState(false);

  // Pull incoming URL query params (e.g. Navbar quick search or SeriesDetail ?category= click)
  useEffect(() => {
    const qParam = searchParams.get("q") || "";
    const rawCatParam =
      searchParams.get("kategori") || searchParams.get("category") || "Tümü";
    const catParam = resolveCanonicalGenre(rawCatParam, categoryList);
    const typeParam = searchParams.get("tur") || "Hepsi";
    const statusParam = searchParams.get("durum") || "Tümü";
    const sortParam = searchParams.get("sirala") || "updated";

    onSyncFromUrl({
      qParam,
      catParam,
      typeParam,
      statusParam,
      sortParam,
    });
    setUrlHydrated(true);
  }, [searchParams, categoryList, onSyncFromUrl]);

  // Push user-modified filters back to URL query string
  useEffect(() => {
    if (!urlHydrated || loading) return;
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (selectedType !== "Hepsi") params.set("tur", selectedType);
    if (selectedGenre !== "Tümü") params.set("kategori", selectedGenre);
    if (selectedStatus !== "Tümü") params.set("durum", selectedStatus);
    if (sortBy !== "updated") params.set("sirala", sortBy);

    const qs = params.toString();
    if (qs === searchParams.toString()) return;
    const targetUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(targetUrl, { scroll: false });
  }, [
    urlHydrated,
    loading,
    debouncedQuery,
    selectedType,
    selectedGenre,
    selectedStatus,
    sortBy,
    pathname,
    router,
    searchParams,
  ]);

  return null;
}

export default function KesfetClient({
  initialWebtoons = [],
  initialNovels = [],
  initialCategories = [],
}) {
  const initialBuilt = useMemo(
    () =>
      buildCatalogData(initialWebtoons, initialNovels, initialCategories),
    [initialWebtoons, initialNovels, initialCategories]
  );

  const hasInitialData = initialBuilt.combined.length > 0;

  const [allSeries, setAllSeries] = useState(initialBuilt.combined);
  const [categoryList, setCategoryList] = useState(
    initialBuilt.resolvedCategories
  );
  const [genres, setGenres] = useState(initialBuilt.chips);
  const [loading, setLoading] = useState(!hasInitialData);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Tümü");
  const [selectedType, setSelectedType] = useState("Hepsi");
  const [selectedStatus, setSelectedStatus] = useState("Tümü");
  const [sortBy, setSortBy] = useState("updated");

  const handleSyncFromUrl = useMemo(
    () => ({ qParam, catParam, typeParam, statusParam, sortParam }) => {
      setSearchInput(qParam);
      setDebouncedQuery(qParam);
      setSelectedGenre(catParam);
      setSelectedType(typeParam);
      setSelectedStatus(statusParam);
      setSortBy(sortParam);
    },
    []
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Client fallback fetch only if SSR initial payload was empty
  useEffect(() => {
    if (hasInitialData) return;
    let active = true;
    const fetchData = async () => {
      try {
        const [webtoonRes, novelRes, catRes] = await Promise.all([
          apiFetch("/webtoons/?limit=1000"),
          apiFetch("/novels/?limit=1000"),
          apiFetch("/categories"),
        ]);

        const webtoons = webtoonRes.ok ? await webtoonRes.json() : [];
        const novels = novelRes.ok ? await novelRes.json() : [];
        const cats = catRes.ok ? await catRes.json() : [];

        if (!active) return;
        const built = buildCatalogData(webtoons, novels, cats);
        setCategoryList(built.resolvedCategories);
        setGenres(built.chips);
        setSelectedGenre((prev) =>
          resolveCanonicalGenre(prev, built.resolvedCategories)
        );
        setAllSeries(built.combined);
      } catch (err) {
        console.error("Keşfet verileri çekilemedi:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [hasInitialData]);

  const filteredSeries = useMemo(() => {
    let result = [...allSeries];

    if (debouncedQuery.trim() !== "") {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.author?.toLowerCase().includes(q)
      );
    }

    if (selectedType !== "Hepsi") {
      result = result.filter((item) => item.type === selectedType);
    }

    if (selectedStatus !== "Tümü") {
      result = result.filter((item) => {
        const st = String(item.status || "ongoing").toLowerCase();
        return selectedStatus === "ongoing"
          ? st === "ongoing" || st === "güncel"
          : st === "completed" || st === "tamamlandı";
      });
    }

    if (selectedGenre !== "Tümü") {
      const wantedRaw = String(selectedGenre).trim();
      const wantedLower = wantedRaw.toLowerCase();
      const matchedCat = categoryList.find(
        (c) =>
          (c.id !== undefined && c.id !== null && String(c.id) === wantedRaw) ||
          (c.slug && String(c.slug).toLowerCase() === wantedLower) ||
          (c.name && String(c.name).toLowerCase() === wantedLower)
      );

      result = result.filter((item) =>
        (item.categories || []).some((c) => {
          if (typeof c === "string") {
            const cLower = c.toLowerCase();
            return (
              cLower === wantedLower ||
              (matchedCat && cLower === matchedCat.name.toLowerCase())
            );
          }
          if (!c || typeof c !== "object") return false;
          const cName = String(c.name || "").toLowerCase();
          const cSlug = String(c.slug || "").toLowerCase();
          const cId = c.id !== undefined && c.id !== null ? String(c.id) : "";
          if (
            cName === wantedLower ||
            cSlug === wantedLower ||
            cId === wantedRaw
          ) {
            return true;
          }
          if (matchedCat) {
            return (
              cName === matchedCat.name.toLowerCase() ||
              (matchedCat.id !== undefined &&
                cId === String(matchedCat.id)) ||
              (matchedCat.slug && cSlug === matchedCat.slug.toLowerCase())
            );
          }
          return false;
        })
      );
    }

    if (sortBy === "popular") {
      result.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    } else if (sortBy === "newest") {
      result.sort(
        (a, b) =>
          (new Date(b.created_at || 0).getTime() || Number(b.id) || 0) -
          (new Date(a.created_at || 0).getTime() || Number(a.id) || 0)
      );
    } else if (sortBy === "az") {
      result.sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""), "tr")
      );
    } else {
      result.sort((a, b) => getLatestTimestamp(b) - getLatestTimestamp(a));
    }

    return result;
  }, [
    allSeries,
    categoryList,
    debouncedQuery,
    selectedType,
    selectedStatus,
    selectedGenre,
    sortBy,
  ]);

  const hasActiveFilters =
    searchInput.trim() !== "" ||
    selectedType !== "Hepsi" ||
    selectedGenre !== "Tümü" ||
    selectedStatus !== "Tümü" ||
    sortBy !== "updated";

  const resetAllFilters = () => {
    setSearchInput("");
    setDebouncedQuery("");
    setSelectedType("Hepsi");
    setSelectedGenre("Tümü");
    setSelectedStatus("Tümü");
    setSortBy("updated");
  };

  return (
    <div className="min-h-screen pb-16 font-sans">
      <Suspense fallback={null}>
        <KesfetQuerySync
          categoryList={categoryList}
          loading={loading}
          debouncedQuery={debouncedQuery}
          selectedType={selectedType}
          selectedGenre={selectedGenre}
          selectedStatus={selectedStatus}
          sortBy={sortBy}
          onSyncFromUrl={handleSyncFromUrl}
        />
      </Suspense>

      {/* DISCOVERY HEADER & FILTER CONTROLS */}
      <div className="bg-surface/80 border-b border-subtle pt-8 pb-6 px-4 sm:px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-ink-primary flex items-center gap-3 tracking-tight">
                <span className="bg-brand/15 border border-brand/30 text-brand w-10 h-10 rounded-xl flex items-center justify-center shadow-sm">
                  <Compass className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>Keşfet</span>
              </h1>
              <p className="text-ink-secondary text-sm mt-1.5">
                Türkçe webtoon, manga ve novel arşivinde tür, durum ve sıralamaya göre ara.
              </p>
            </div>

            {/* Format Filter */}
            <div
              role="group"
              aria-label="Format filtresi"
              className="inline-flex items-center gap-1 rounded-xl border border-subtle bg-surface p-1 self-start sm:self-auto"
            >
              {TYPE_OPTIONS.map((t) => {
                const active = selectedType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedType(t.value)}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                      active
                        ? "bg-elevated text-ink-primary shadow-sm ring-1 ring-white/10"
                        : "text-ink-secondary hover:text-ink-primary"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Search Input + Status & Sort Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="relative md:col-span-6 lg:col-span-7">
                <Search className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  className="w-full bg-canvas border border-subtle focus:border-brand text-ink-primary rounded-xl py-2.5 pl-10 pr-9 text-sm focus:ring-2 focus:ring-brand/30 transition outline-none placeholder:text-ink-muted"
                  placeholder="Seri adı veya yazar ara..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
                    aria-label="Aramayı Temizle"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="relative md:col-span-3 lg:col-span-2">
                <SlidersHorizontal className="h-4 w-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Seri Durumu"
                  className="w-full bg-canvas border border-subtle hover:border-hover focus:border-brand text-ink-primary rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none cursor-pointer"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative md:col-span-3 lg:col-span-3">
                <ArrowUpDown className="h-4 w-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sıralama"
                  className="w-full bg-canvas border border-subtle hover:border-hover focus:border-brand text-ink-primary rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category / Genre Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
              {genres.map((genre) => {
                const active = selectedGenre === genre;
                return (
                  <button
                    key={genre}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                      active
                        ? "bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-950/50"
                        : "bg-canvas text-ink-secondary border-subtle hover:border-hover hover:text-ink-primary"
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS AREA */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <h2 className="sr-only">Keşfet Seri Listesi</h2>
        <div className="mb-6 flex flex-wrap justify-between items-center gap-3 text-ink-secondary text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Toplam{" "}
              <strong className="text-ink-primary font-bold">
                {loading ? "..." : filteredSeries.length}
              </strong>{" "}
              seri
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-surface hover:bg-elevated px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink-primary transition"
              >
                <RotateCcw className="h-3 w-3 text-brand" />
                <span>Filtreleri Sıfırla</span>
              </button>
            )}
          </div>

          <span className="text-xs uppercase tracking-wider text-ink-muted font-semibold">
            {SORT_OPTIONS.find((s) => s.value === sortBy)?.label}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-9">
            {Array.from({ length: 10 }).map((_, idx) => (
              <SeriesCardSkeleton key={idx} />
            ))}
          </div>
        ) : filteredSeries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-9">
            {filteredSeries.map((s, idx) => (
              <SeriesCard key={`${s.type}-${s.id}`} series={s} priority={idx < 4} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-subtle rounded-3xl bg-surface/60">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 border border-brand/25 text-brand mb-4">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-ink-primary mb-1.5">
              Eşleşen seri bulunamadı
            </h3>
            <p className="text-ink-secondary text-sm max-w-md mb-6">
              Seçtiğin filtre veya arama terimiyle eşleşen bir webtoon, manga veya novel
              bulunamadı.
            </p>
            <Button variant="primary" size="md" onClick={resetAllFilters}>
              <RotateCcw className="h-4 w-4" />
              <span>Filtreleri Temizle</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
