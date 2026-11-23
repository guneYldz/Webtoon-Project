"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Megaphone,
  BookOpen,
  MessageSquare,
  ArrowRight,
  Loader2,
  Inbox,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "@/lib/apiClient";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui";

const GUEST_SEEN_KEY = "duyuru_last_seen";

export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    try {
      setToken(window.localStorage.getItem("token"));
    } catch {
      setToken(null);
    }
  }, [user]);

  const isGuest = !user || !token;

  const fetchUnreadLoggedIn = async () => {
    if (!token) return;
    try {
      const res = await apiFetch("/notifications/unread-count", {
        auth: "user",
      });
      if (res.ok) {
        const data = await res.json();
        setUnread(data.count || 0);
      }
    } catch (_) {}
  };

  const fetchGuestUnread = async () => {
    try {
      const res = await apiFetch("/notifications/announcements?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const lastSeen = parseInt(
        localStorage.getItem(GUEST_SEEN_KEY) || "0",
        10
      );
      const count = list.filter(
        (a) => new Date(a.created_at).getTime() > lastSeen
      ).length;
      setUnread(count);
    } catch (_) {}
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      if (!isGuest) {
        const res = await apiFetch("/notifications/?limit=40", {
          auth: "user",
        });
        if (res.ok) {
          const data = await res.json();
          setItems(Array.isArray(data) ? data : []);
        }
      } else {
        const res = await apiFetch("/notifications/announcements?limit=30");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          const lastSeen = parseInt(
            localStorage.getItem(GUEST_SEEN_KEY) || "0",
            10
          );
          setItems(
            list.map((a) => ({
              id: a.id,
              type: "announcement",
              title: a.title,
              message: a.message,
              image: a.image,
              link: `/duyurular#duyuru-${a.id}`,
              is_read: new Date(a.created_at).getTime() <= lastSeen,
              created_at: a.created_at,
            }))
          );
        }
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    if (!isGuest) {
      if (!token || unread === 0) return;
      try {
        await apiFetch("/notifications/mark-all-read", {
          method: "POST",
          auth: "user",
        });
        setUnread(0);
        setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      } catch (_) {}
    } else {
      localStorage.setItem(GUEST_SEEN_KEY, String(Date.now()));
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  useEffect(() => {
    if (isGuest) {
      fetchGuestUnread();
      const interval = setInterval(fetchGuestUnread, 120000);
      return () => clearInterval(interval);
    }
    fetchUnreadLoggedIn();
    const interval = setInterval(fetchUnreadLoggedIn, 60000);
    return () => clearInterval(interval);
  }, [user, token, isGuest]);

  const handleOpenChange = async (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) {
      await fetchList();
      await markAllRead();
    }
  };

  const timeAgo = (dateStr) => {
    try {
      const d = new Date(dateStr);
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return "az önce";
      if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
      if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
      return d.toLocaleDateString("tr-TR");
    } catch {
      return "";
    }
  };

  const renderTypeIcon = (type) => {
    if (type === "announcement") {
      return <Megaphone className="h-4 w-4 text-brand" />;
    }
    if (type === "favorite_update") {
      return <BookOpen className="h-4 w-4 text-sky-400" />;
    }
    return <MessageSquare className="h-4 w-4 text-emerald-400" />;
  };

  const panelTitle = isGuest ? "Duyurular" : "Bildirimler";
  const emptyText = isGuest ? "Henüz duyuru yok." : "Henüz bildirimin yok.";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          aria-label={panelTitle}
          title={panelTitle}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center ring-2 ring-canvas shadow">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[340px] sm:w-[360px] p-0 overflow-hidden flex flex-col max-h-[72vh]"
      >
        <div className="px-4 py-3 border-b border-subtle flex items-center justify-between shrink-0 bg-surface/60">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-brand" />
            <h3 className="text-sm font-bold text-ink-primary">{panelTitle}</h3>
          </div>
          <span className="text-xs text-ink-muted">{items.length} kayıt</span>
        </div>

        <div className="overflow-y-auto flex-1 overscroll-contain divide-y divide-white/[0.05]">
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink-muted text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <span>Yükleniyor...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink-muted text-sm">
              <Inbox className="h-6 w-6 text-ink-muted/60" />
              <span>{emptyText}</span>
            </div>
          ) : (
            items.map((n) => {
              const inner = (
                <div
                  className={`px-4 py-3.5 hover:bg-white/[0.04] transition-colors ${
                    !n.is_read ? "bg-brand/[0.06]" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-subtle bg-surface">
                      {renderTypeIcon(n.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-primary leading-snug">
                        {n.title}
                      </p>
                      <p className="text-xs text-ink-secondary mt-1 leading-relaxed break-words line-clamp-3">
                        {n.message}
                      </p>
                      {n.image && (
                        <img
                          src={resolveMediaUrl(n.image)}
                          alt=""
                          className="mt-2 w-full max-h-24 object-cover rounded-lg border border-subtle"
                        />
                      )}
                      <p className="text-[11px] text-ink-muted mt-1.5">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              );

              const href =
                n.link ||
                (n.type === "announcement" ? `/duyurular#duyuru-${n.id}` : null);
              if (href) {
                return (
                  <Link
                    key={`${n.type}-${n.id}`}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="block"
                  >
                    {inner}
                  </Link>
                );
              }
              return <div key={`${n.type}-${n.id}`}>{inner}</div>;
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-subtle shrink-0 bg-surface/60">
          <Link
            href="/duyurular"
            onClick={() => setOpen(false)}
            className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-brand hover:text-purple-300 transition-colors"
          >
            <span>Tüm duyuruları gör</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
