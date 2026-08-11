"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { API } from "@/api";

const GUEST_SEEN_KEY = "duyuru_last_seen";

/**
 * Navbar zil bildirimi.
 * - Girişli: kişisel bildirimler (yanıt, favori, duyuru)
 * - Misafir: sadece duyurular (tıklanınca /duyurular)
 * - Mobilde panel viewport içinde sabitlenir (taşmaz)
 */
export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 12, width: 320 });
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const isGuest = !user || !token;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchUnreadLoggedIn = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnread(data.count || 0);
      }
    } catch (_) {}
  };

  const fetchGuestUnread = async () => {
    try {
      const res = await fetch(`${API}/notifications/announcements?limit=20`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const lastSeen = parseInt(localStorage.getItem(GUEST_SEEN_KEY) || "0", 10);
      const count = list.filter((a) => new Date(a.created_at).getTime() > lastSeen).length;
      setUnread(count);
    } catch (_) {}
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      if (!isGuest) {
        const res = await fetch(`${API}/notifications/?limit=40`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setItems(Array.isArray(data) ? data : []);
        }
      } else {
        const res = await fetch(`${API}/notifications/announcements?limit=30`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          const lastSeen = parseInt(localStorage.getItem(GUEST_SEEN_KEY) || "0", 10);
          setItems(
            list.map((a) => ({
              id: a.id,
              type: "announcement",
              title: a.title,
              message: a.message,
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
        await fetch(`${API}/notifications/mark-all-read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
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
  }, [user]);

  // Panel pozisyonunu ekrana sığdır (özellikle mobil)
  const updatePanelPos = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(360, window.innerWidth - margin * 2);
    // Zilin sağ kenarına hizala, ama sol/sağ taşmasın
    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    setPanelPos({
      top: rect.bottom + 10,
      left,
      width,
    });
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function handleResize() {
      if (open) updatePanelPos();
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleResize, true);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [open]);

  const handleToggle = async () => {
    const next = !open;
    if (next) updatePanelPos();
    setOpen(next);
    if (next) {
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

  const panelTitle = isGuest ? "Duyurular" : "Bildirimler";
  const emptyText = isGuest ? "Henüz duyuru yok." : "Henüz bildirimin yok.";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative p-2 rounded-full text-gray-400 hover:text-gray-200 hover:bg-white/5 transition"
        aria-label={panelTitle}
        title={panelTitle}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3.2.8 4.6 1.5 5.8.3.5-.1 1.2-.7 1.2H5.7c-.6 0-1-.7-.7-1.2.7-1.2 1.5-2.6 1.5-5.8z" />
          <path d="M10 4.2a2 2 0 0 1 4 0" />
          <path d="M10.2 16.5a1.8 1.8 0 0 0 3.6 0" />
          <path d="M3.5 9.2c-.6.9-.9 2-.9 3.1" />
          <path d="M1.8 8.2c-.9 1.3-1.4 2.8-1.4 4.4" opacity="0.55" />
          <path d="M20.5 9.2c.6.9.9 2 .9 3.1" />
          <path d="M22.2 8.2c.9 1.3 1.4 2.8 1.4 4.4" opacity="0.55" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#1a1a1a] shadow">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && isMounted && createPortal(
        <div
          ref={panelRef}
          className="fixed max-h-[70vh] bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col"
          style={{
            top: `${panelPos.top}px`,
            left: `${panelPos.left}px`,
            width: `${panelPos.width}px`,
          }}
        >
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-white">{panelTitle}</h3>
            <span className="text-xs text-gray-500">{items.length} kayıt</span>
          </div>

          <div className="overflow-y-auto flex-1 overscroll-contain">
            {loading && items.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Yükleniyor...</p>
            ) : items.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10 italic">{emptyText}</p>
            ) : (
              items.map((n) => {
                const inner = (
                  <div className={`px-4 py-3 border-b border-gray-800/60 hover:bg-white/[0.03] transition ${!n.is_read ? "bg-purple-500/5" : ""}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">
                        {n.type === "announcement" ? "📢" : n.type === "favorite_update" ? "📚" : "💬"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-100 leading-snug">{n.title}</p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed break-words line-clamp-3">{n.message}</p>
                        <p className="text-[11px] text-gray-600 mt-1.5">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                );

                const href = n.link || (n.type === "announcement" ? `/duyurular#duyuru-${n.id}` : null);
                if (href) {
                  return (
                    <Link key={`${n.type}-${n.id}`} href={href} onClick={() => setOpen(false)}>
                      {inner}
                    </Link>
                  );
                }
                return <div key={`${n.type}-${n.id}`}>{inner}</div>;
              })
            )}
          </div>

          {isGuest && (
            <div className="px-4 py-2.5 border-t border-gray-800 shrink-0">
              <Link
                href="/duyurular"
                onClick={() => setOpen(false)}
                className="block text-center text-xs font-bold text-purple-400 hover:text-purple-300"
              >
                Tüm duyuruları gör →
              </Link>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
