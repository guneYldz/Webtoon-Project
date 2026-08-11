"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { API } from "@/api";

/**
 * Navbar zil bildirimi.
 * - Zile tıklanınca dropdown açılır + tümü okundu işaretlenir (liste silinmez)
 * - Okunmamış varken kırmızı nokta + sayı
 */
export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const fetchUnread = async () => {
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

  const fetchList = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/notifications/?limit=40`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    if (!token || unread === 0) return;
    try {
      await fetch(`${API}/notifications/mark-all-read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (_) {}
  };

  useEffect(() => {
    if (!user || !token) {
      setUnread(0);
      setItems([]);
      return;
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!user) return null;

  const handleToggle = async () => {
    const next = !open;
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

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative p-2 rounded-full text-gray-400 hover:text-gray-200 hover:bg-white/5 transition"
        aria-label="Bildirimler"
        title="Bildirimler"
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
          {/* Zil gövdesi */}
          <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3.2.8 4.6 1.5 5.8.3.5-.1 1.2-.7 1.2H5.7c-.6 0-1-.7-.7-1.2.7-1.2 1.5-2.6 1.5-5.8z" />
          {/* Tutamak */}
          <path d="M10 4.2a2 2 0 0 1 4 0" />
          {/* Çekiç / dil */}
          <path d="M10.2 16.5a1.8 1.8 0 0 0 3.6 0" />
          {/* Sol ses yayları */}
          <path d="M3.5 9.2c-.6.9-.9 2-.9 3.1" />
          <path d="M1.8 8.2c-.9 1.3-1.4 2.8-1.4 4.4" opacity="0.55" />
          {/* Sağ ses yayları */}
          <path d="M20.5 9.2c.6.9.9 2 .9 3.1" />
          <path d="M22.2 8.2c.9 1.3 1.4 2.8 1.4 4.4" opacity="0.55" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#1a1a1a] shadow">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-3 w-[min(92vw,360px)] max-h-[70vh] bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-white">Bildirimler</h3>
            <span className="text-xs text-gray-500">{items.length} kayıt</span>
          </div>

          <div className="overflow-y-auto flex-1 overscroll-contain">
            {loading && items.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Yükleniyor...</p>
            ) : items.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10 italic">Henüz bildirimin yok.</p>
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

                if (n.link) {
                  return (
                    <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                      {inner}
                    </Link>
                  );
                }
                return <div key={n.id}>{inner}</div>;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
