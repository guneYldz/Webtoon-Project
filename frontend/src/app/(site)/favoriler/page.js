"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Compass } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import SeriesCard, { SeriesCardSkeleton } from "@/components/SeriesCard";
import {
  Badge,
  buttonClasses,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";

const FILTER_TABS = [
  { value: "ALL", label: "Tümü" },
  { value: "WEBTOON", label: "Webtoon & Manga" },
  { value: "NOVEL", label: "Novel" },
];

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    const fetchFavorites = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await apiFetch("/favorites/listele", { auth: "user" });
        if (res.ok) {
          const data = await res.json();
          setFavorites(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Favoriler çekilemedi:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [router]);

  const filteredFavorites = useMemo(() => {
    if (filter === "ALL") return favorites;
    return favorites.filter((fav) => {
      const isNovel =
        String(fav.type || fav.tag || "").toUpperCase().includes("NOVEL");
      return filter === "NOVEL" ? isNovel : !isNovel;
    });
  }, [favorites, filter]);

  return (
    <div className="min-h-screen pb-16 font-sans">
      {/* HEADER */}
      <div className="bg-surface/80 border-b border-subtle pt-8 pb-6 px-4 sm:px-6 mb-8">
        <div className="container mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-ink-primary flex items-center gap-3 tracking-tight">
              <span className="bg-rose-500/15 border border-rose-500/30 text-rose-400 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm">
                <Heart className="h-5 w-5 fill-rose-500/20" />
              </span>
              <span>Favori Serilerim</span>
              <Badge variant="default" size="md" className="ml-1">
                {favorites.length} Takipte
              </Badge>
            </h1>
            <p className="text-ink-secondary text-sm mt-1.5">
              Takip ettiğin ve kütüphanene eklediğin tüm webtoon, manga ve novel serileri.
            </p>
          </div>

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList variant="pills">
              {FILTER_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* CONTENT */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SeriesCardSkeleton key={idx} />
            ))}
          </div>
        ) : filteredFavorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-5">
            {filteredFavorites.map((fav, index) => (
              <SeriesCard
                key={`${fav.type}-${fav.id || index}`}
                series={fav}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-subtle rounded-3xl bg-surface/60">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 mb-4">
              <Heart className="h-6 w-6" />
            </div>
            <h2 className="text-xl text-ink-primary font-bold mb-2">
              Henüz Favori Serin Yok
            </h2>
            <p className="text-ink-secondary text-sm mb-6 max-w-md mx-auto">
              Beğendiğin webtoon, manga veya novelleri seri sayfasından favorilerine
              ekleyerek kendi okuma kütüphaneni oluşturabilirsin.
            </p>
            <Link
              href="/kesfet"
              className={buttonClasses({ variant: "primary", size: "lg" })}
            >
              <Compass className="h-4 w-4" />
              <span>Serileri Keşfet</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
