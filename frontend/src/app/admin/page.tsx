"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Palette,
  BookOpen,
  Users,
  Eye,
  MessageSquare,
  FolderTree,
  FilePlus2,
  Plus,
} from "lucide-react";
import {
  apiFetch,
  clearAdminToken,
  getAdminToken,
} from "@/lib/apiClient";
import { Skeleton } from "@/components/ui";
import { AdminPageHeader, adminCardClass } from "./_components/AdminUi";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_webtoons: 0,
    total_users: 0,
    total_views: 0,
    total_novels: 0,
    published_webtoons: 0,
    published_novels: 0,
    total_comments: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const token = getAdminToken();
      if (!token) {
        router.replace("/login-admin");
        return;
      }

      try {
        const res = await apiFetch("/admin/stats", {
          auth: "admin",
          cache: "no-store",
        });

        if (res.status === 401) {
          clearAdminToken();
          router.replace("/login-admin");
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setStats(data.status === "success" ? data.data : data);
        }
      } catch (error) {
        console.error("Stats yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [router]);

  const statCards = [
    {
      label: "Webtoon & Manga",
      value: stats.total_webtoons || 0,
      sub: `${stats.published_webtoons || 0} Yayında`,
      icon: Palette,
      accent: "text-sky-400 bg-sky-500/15 border-sky-500/30",
    },
    {
      label: "Noveller",
      value: stats.total_novels || 0,
      sub: `${stats.published_novels || 0} Yayında`,
      icon: BookOpen,
      accent: "text-purple-400 bg-purple-500/15 border-purple-500/30",
    },
    {
      label: "Üyeler",
      value: stats.total_users || 0,
      sub: "Kayıtlı kullanıcı",
      icon: Users,
      accent: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    },
    {
      label: "Toplam Görüntülenme",
      value: stats.total_views || 0,
      sub: `${(stats.total_comments || 0).toLocaleString("tr-TR")} Yorum`,
      icon: Eye,
      accent: "text-amber-400 bg-amber-500/15 border-amber-500/30",
    },
  ];

  const quickActions = [
    {
      href: "/admin/webtoon-ekle?series_type=WEBTOON",
      title: "Webtoon Ekle",
      desc: "Yeni webtoon serisi oluştur",
      icon: Palette,
      tint: "text-sky-400",
    },
    {
      href: "/admin/webtoon-ekle?series_type=MANGA",
      title: "Manga Ekle",
      desc: "Yeni manga serisi oluştur",
      icon: Plus,
      tint: "text-amber-400",
    },
    {
      href: "/admin/novel-ekle",
      title: "Yeni Novel Ekle",
      desc: "Roman serisi oluştur",
      icon: BookOpen,
      tint: "text-purple-400",
    },
    {
      href: "/admin/bolum-ekle?series_type=WEBTOON",
      title: "Webtoon Bölüm Yükle",
      desc: "Tekli veya klasör toplu yükle",
      icon: FilePlus2,
      tint: "text-sky-400",
    },
    {
      href: "/admin/bolum-ekle?series_type=MANGA",
      title: "Manga Bölüm Yükle",
      desc: "Tekli veya klasör toplu yükle",
      icon: FilePlus2,
      tint: "text-amber-400",
    },
    {
      href: "/admin/novel-bolum-ekle",
      title: "Novel Bölüm Yükle",
      desc: "Zengin metin editörü ile yayınla",
      icon: FilePlus2,
      tint: "text-purple-400",
    },
    {
      href: "/admin/categories",
      title: "Kategoriler",
      desc: "Tür etiketlerini düzenle",
      icon: FolderTree,
      tint: "text-emerald-400",
    },
    {
      href: "/admin/comments",
      title: "Yorum Moderasyonu",
      desc: "Son kullanıcı yorumlarını denetle",
      icon: MessageSquare,
      tint: "text-rose-400",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Genel Bakış"
        description="Platform istatistikleri ve içerik ekleme kısayolları."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))
          : statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`${adminCardClass} p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
                      {card.label}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center ${card.accent}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-ink-primary tabular-nums">
                    {Number(card.value).toLocaleString("tr-TR")}
                  </p>
                  <p className="text-xs text-ink-muted mt-1">{card.sub}</p>
                </div>
              );
            })}
      </div>

      <div className={`${adminCardClass} p-6`}>
        <h2 className="text-base font-bold text-ink-primary mb-4">
          Hızlı İşlemler
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group p-4 rounded-xl bg-canvas/70 border border-subtle hover:border-brand/50 hover:bg-elevated transition flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-surface border border-subtle flex items-center justify-center shrink-0 group-hover:border-white/15">
                  <Icon className={`h-4 w-4 ${item.tint}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-primary group-hover:text-white truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5 line-clamp-1">
                    {item.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
