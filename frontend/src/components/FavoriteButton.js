"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getUserToken } from "@/lib/apiClient";

export default function FavoriteButton({ type, id, className = "" }) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!id || !type) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    const checkStatus = async () => {
      const token = getUserToken();
      if (!token) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const res = await apiFetch(`/favorites/check/${type}/${id}`, {
          method: "GET",
          auth: "user",
          cache: "no-store",
        });

        if (res.ok && !cancelled) {
          const data = await res.json();
          setIsFavorite(Boolean(data?.is_favorited));
        }
      } catch (err) {
        console.error("Favori kontrol hatası:", err);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [id, type]);

  const toggleFavorite = async () => {
    const token = getUserToken();
    if (!token) {
      toast.info("Favorilere eklemek için giriş yapmalısın.", {
        action: {
          label: "Giriş Yap",
          onClick: () => router.push("/login"),
        },
      });
      return;
    }

    if (!id || loading) return;

    setLoading(true);
    const previousState = isFavorite;
    setIsFavorite(!isFavorite);

    const payload = type === "novel" ? { novel_id: id } : { webtoon_id: id };

    try {
      const res = await apiFetch("/favorites/toggle", {
        method: "POST",
        auth: "user",
        json: payload,
      });

      if (res.status === 401) {
        setIsFavorite(previousState);
        toast.info("Oturumun sona erdi, lütfen tekrar giriş yap.", {
          action: {
            label: "Giriş Yap",
            onClick: () => router.push("/login"),
          },
        });
        return;
      }

      if (!res.ok) {
        setIsFavorite(previousState);
        toast.error("Favori işlemi başarısız oldu.");
        return;
      }

      const data = await res.json();
      if (data?.is_favorited !== undefined) {
        setIsFavorite(Boolean(data.is_favorited));
      }
      toast.success(
        (data?.is_favorited ?? !previousState)
          ? "Favorilere eklendi."
          : "Favorilerden çıkarıldı."
      );
    } catch (err) {
      console.error("Favori hatası:", err);
      setIsFavorite(previousState);
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const defaultBase =
    "h-11 px-5 rounded-xl font-semibold text-sm border transition-all duration-200 ease-smooth inline-flex items-center justify-center gap-2 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60";

  const stateClass = className
    ? `${className} ${
        isFavorite
          ? "!bg-rose-600/90 !border-rose-400/60 !text-white !shadow-md !shadow-rose-950/40"
          : ""
      }`
    : `${defaultBase} ${
        isFavorite
          ? "bg-rose-500/20 border-rose-500/50 text-rose-200 hover:bg-rose-500/30 shadow-sm shadow-rose-950/30"
          : "bg-elevated/90 border-white/15 text-ink-primary hover:border-rose-400/50 hover:text-rose-200 hover:bg-white/[0.06]"
      }`;

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={loading || checking || !id}
      aria-pressed={isFavorite}
      className={`group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${stateClass}`}
    >
      {loading || checking ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
          <span>{checking ? "Kontrol ediliyor..." : "İşleniyor..."}</span>
        </>
      ) : isFavorite ? (
        <>
          <Heart
            className="h-4 w-4 fill-rose-400 text-rose-400 transition-transform duration-200 group-hover:scale-110 shrink-0"
            aria-hidden="true"
          />
          <span>Favorilerde</span>
        </>
      ) : (
        <>
          <Heart
            className="h-4 w-4 text-current transition-transform duration-200 group-hover:scale-110 shrink-0"
            aria-hidden="true"
          />
          <span>Favorilere Ekle</span>
        </>
      )}
    </button>
  );
}
