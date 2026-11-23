"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  MessageSquare,
  Heart,
  CornerDownRight,
  UserX,
  Home,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "@/lib/apiClient";
import SeriesCard from "@/components/SeriesCard";
import {
  Badge,
  buttonClasses,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";

export default function KullaniciProfilSayfasi() {
  const params = useParams();
  const username = params?.username
    ? decodeURIComponent(params.username)
    : null;

  const [profile, setProfile] = useState(null);
  const [comments, setComments] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("yorumlar");

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        const pRes = await apiFetch(
          `/auth/kullanici/${encodeURIComponent(username)}`
        );
        if (!pRes.ok) {
          setNotFound(true);
          return;
        }
        setProfile(await pRes.json());

        const [cRes, fRes] = await Promise.all([
          apiFetch(`/comments/kullanici/${encodeURIComponent(username)}`),
          apiFetch(`/favorites/kullanici/${encodeURIComponent(username)}`),
        ]);
        if (cRes.ok) setComments(await cRes.json());
        if (fRes.ok) setFavorites(await fRes.json());
      } catch (err) {
        console.error("Profil yüklenemedi:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-10 space-y-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="rounded-3xl border border-subtle bg-surface p-8 max-w-md w-full">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 text-brand">
            <UserX className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-ink-primary mb-2">
            Kullanıcı Bulunamadı
          </h1>
          <p className="text-sm text-ink-secondary mb-6">
            Aradığınız kullanıcı profili mevcut değil veya kullanıcı adını değiştirmiş olabilir.
          </p>
          <Link
            href="/"
            className={buttonClasses({ variant: "primary", size: "md" })}
          >
            <Home className="h-4 w-4" />
            <span>Ana Sayfaya Dön</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 font-sans">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-10">
        {/* PROFILE HEADER */}
        <div className="relative bg-surface/90 rounded-3xl border border-subtle p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-center gap-6 shadow-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-indigo-500 to-purple-400 opacity-75" />

          <div className="w-24 h-24 rounded-full ring-2 ring-brand/60 ring-offset-4 ring-offset-surface overflow-hidden bg-elevated shrink-0">
            {profile.profile_image ? (
              <img
                src={resolveMediaUrl(profile.profile_image)}
                alt={profile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-black text-brand bg-brand/10">
                {profile.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2.5 justify-center sm:justify-start flex-wrap">
              <h1 className="text-2xl font-black text-ink-primary">
                {profile.username}
              </h1>
              <Badge
                variant={
                  profile.role === "admin"
                    ? "new"
                    : profile.role === "editor"
                    ? "manga"
                    : "webtoon"
                }
                size="md"
              >
                {profile.role || "user"}
              </Badge>
            </div>

            <p className="inline-flex items-center gap-1.5 text-ink-secondary text-xs sm:text-sm mt-1.5">
              <Calendar className="h-3.5 w-3.5 text-brand" />
              <span>
                Katılım:{" "}
                {new Date(profile.created_at).toLocaleDateString("tr-TR")}
              </span>
            </p>

            {/* STATS */}
            <div className="flex gap-6 mt-4 justify-center sm:justify-start">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-base font-black text-ink-primary leading-none">
                    {profile.comment_count ?? comments.length}
                  </p>
                  <p className="text-[11px] text-ink-muted uppercase tracking-wider">
                    Yorum
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                  <Heart className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-base font-black text-ink-primary leading-none">
                    {profile.favorite_count ?? favorites.length}
                  </p>
                  <p className="text-[11px] text-ink-muted uppercase tracking-wider">
                    Favori
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="underline" className="w-full justify-start mb-6">
            <TabsTrigger value="yorumlar" variant="underline">
              <MessageSquare className="h-4 w-4" />
              <span>Yorumlar ({comments.length})</span>
            </TabsTrigger>
            <TabsTrigger value="favoriler" variant="underline">
              <Heart className="h-4 w-4" />
              <span>Favoriler ({favorites.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="yorumlar">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-subtle bg-surface/50">
                <MessageSquare className="h-8 w-8 text-ink-muted mb-2" />
                <p className="text-ink-secondary text-sm">
                  Henüz yorum yapmamış.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="bg-surface p-5 rounded-2xl border border-subtle"
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs sm:text-sm flex-wrap">
                      {c.link ? (
                        <Link
                          href={c.link}
                          className="text-brand font-bold hover:text-purple-300 transition-colors"
                        >
                          {c.seri_title} — {c.bolum_title}
                        </Link>
                      ) : (
                        <span className="text-ink-secondary font-bold">
                          {c.seri_title || "Bilinmeyen bölüm"}
                        </span>
                      )}
                      {c.parent_id && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted bg-elevated px-2 py-0.5 rounded-full border border-subtle">
                          <CornerDownRight className="h-3 w-3" />
                          <span>Yanıt</span>
                        </span>
                      )}
                      <span className="text-ink-muted text-xs ml-auto">
                        {new Date(c.created_at).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                    <p className="text-ink-primary text-sm leading-relaxed break-words">
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="favoriler">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-subtle bg-surface/50">
                <Heart className="h-8 w-8 text-ink-muted mb-2" />
                <p className="text-ink-secondary text-sm">
                  Henüz favori serisi yok.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                {favorites.map((f, idx) => (
                  <SeriesCard key={`${f.type}-${f.id || idx}`} series={f} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
