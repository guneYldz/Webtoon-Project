"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Star, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getUserToken } from "@/lib/apiClient";

export default function SeriesRatingWidget({
  type = "webtoon",
  seriesId,
  initialAvg = 0,
  initialCount = 0,
}) {
  const router = useRouter();
  const normalizedType = type === "novel" ? "novel" : "webtoon";

  const [ratingAvg, setRatingAvg] = useState(Number(initialAvg) || 0);
  const [ratingCount, setRatingCount] = useState(Number(initialCount) || 0);
  const [userRating, setUserRating] = useState(null);
  const [hoverScore, setHoverScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchRatingState = useCallback(async () => {
    if (!seriesId) return;
    try {
      const hasToken = Boolean(getUserToken());
      const res = await apiFetch(`/ratings/${normalizedType}/${seriesId}`, {
        auth: hasToken ? "user" : "none",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.rating_avg === "number") {
          setRatingAvg(data.rating_avg);
        }
        if (typeof data?.rating_count === "number") {
          setRatingCount(data.rating_count);
        }
        setUserRating(
          typeof data?.user_rating === "number" ? data.user_rating : null
        );
      }
    } catch {
      // Keep initial SSR props on error
    }
  }, [normalizedType, seriesId]);

  useEffect(() => {
    fetchRatingState();

    const handleAuthChange = () => {
      fetchRatingState();
    };
    window.addEventListener("auth-change", handleAuthChange);
    return () => {
      window.removeEventListener("auth-change", handleAuthChange);
    };
  }, [fetchRatingState]);

  const handleRate = async (score) => {
    const token = getUserToken();
    if (!token) {
      toast.info("Seriyi puanlamak için giriş yapmalısın.", {
        action: {
          label: "Giriş Yap",
          onClick: () => router.push("/login"),
        },
      });
      return;
    }

    if (!seriesId || submitting) return;
    setSubmitting(true);

    const prevUserRating = userRating;
    setUserRating(score);

    try {
      const res = await apiFetch(`/ratings/${normalizedType}/${seriesId}`, {
        method: "POST",
        auth: "user",
        json: { score },
      });

      if (!res.ok) {
        setUserRating(prevUserRating);
        const err = await res.json().catch(() => ({}));
        toast.error(err?.detail || "Puan kaydedilemedi.");
        return;
      }

      const data = await res.json();
      if (typeof data?.rating_avg === "number") setRatingAvg(data.rating_avg);
      if (typeof data?.rating_count === "number") {
        setRatingCount(data.rating_count);
      }
      setUserRating(
        typeof data?.user_rating === "number" ? data.user_rating : score
      );
      toast.success(`Puanınız kaydedildi (${score}/5 ★)`);
    } catch {
      setUserRating(prevUserRating);
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveRating = async () => {
    if (!seriesId || submitting || userRating === null) return;
    setSubmitting(true);

    const prevUserRating = userRating;
    setUserRating(null);

    try {
      const res = await apiFetch(`/ratings/${normalizedType}/${seriesId}`, {
        method: "DELETE",
        auth: "user",
      });

      if (!res.ok) {
        setUserRating(prevUserRating);
        toast.error("Puan kaldırılamadı.");
        return;
      }

      const data = await res.json();
      if (typeof data?.rating_avg === "number") setRatingAvg(data.rating_avg);
      if (typeof data?.rating_count === "number") {
        setRatingCount(data.rating_count);
      }
      setUserRating(null);
      toast.success("Puanınız kaldırıldı.");
    } catch {
      setUserRating(prevUserRating);
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeStars =
    hoverScore > 0
      ? hoverScore
      : userRating !== null
      ? userRating
      : Math.round(ratingAvg);

  return (
    <div className="inline-flex flex-wrap items-center gap-3 rounded-xl border border-subtle bg-elevated/85 backdrop-blur-md px-3.5 py-2 mb-5">
      {/* Interactive 5-Star Row */}
      <div
        className="inline-flex items-center gap-1"
        onMouseLeave={() => setHoverScore(0)}
        role="group"
        aria-label="Seriyi 1 ile 5 yıldız arasında puanla"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= activeStars;
          return (
            <button
              key={star}
              type="button"
              disabled={submitting}
              onMouseEnter={() => setHoverScore(star)}
              onClick={() => handleRate(star)}
              aria-label={`${star} yıldız ver`}
              title={`${star} Yıldız`}
              className="p-0.5 transition-transform duration-150 hover:scale-110 focus-visible:outline-none disabled:opacity-50"
            >
              <Star
                className={`h-4 w-4 transition-colors ${
                  filled
                    ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]"
                    : "text-ink-muted hover:text-amber-300"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Score Summary */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-bold text-amber-300 tabular-nums">
          {ratingCount > 0 ? Number(ratingAvg).toFixed(1) : "—"}
        </span>
        <span className="text-ink-muted tabular-nums">
          ({ratingCount} {ratingCount === 1 ? "oy" : "oy"})
        </span>
      </div>

      {/* User's own vote indicator + Remove option */}
      {userRating !== null && (
        <div className="inline-flex items-center gap-1.5 pl-2 border-l border-subtle text-xs">
          <span className="text-ink-secondary font-medium">
            Senin puanın:{" "}
            <strong className="text-amber-300 font-bold">{userRating}★</strong>
          </span>
          <button
            type="button"
            disabled={submitting}
            onClick={handleRemoveRating}
            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] text-ink-muted hover:text-rose-400 hover:bg-white/5 transition"
            title="Puanımı kaldır"
          >
            <X className="h-3 w-3" />
            <span>Oyu Kaldır</span>
          </button>
        </div>
      )}
    </div>
  );
}
