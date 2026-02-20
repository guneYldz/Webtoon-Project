"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image"; // Image import edildi
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [isMounted, setIsMounted] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  const isReadingPage = pathname.includes("/bolum") || pathname.includes("/oku");

  const checkUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch (err) {
      console.error("Kullanıcı doğrulanamadı:", err);
      setUser(null);
    }
  };

  useEffect(() => {
    checkUser();
    window.addEventListener("auth-change", checkUser);
    return () => window.removeEventListener("auth-change", checkUser);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Portal için mount durumu ve pozisyon hesaplama
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 12, // 12px gap
        right: window.innerWidth - rect.right
      });
    }
  }, [isDropdownOpen]);

  const handleLogout = () => {
    localStorage.clear();
    window.dispatchEvent(new Event("auth-change"));
    setUser(null);
    setIsDropdownOpen(false);
    router.push("/login");
  };

  return (
    <nav
      className={`bg-[#1a1a1a] border-b border-gray-800 z-[1000] h-20 max-h-20 shadow-md ${isReadingPage ? "relative" : "sticky top-0"
        }`}
    >
      <div className="container mx-auto max-w-7xl px-4 h-full flex items-center justify-between">

        {/* SOL: LOGO */}
        <Link href="/" className="flex items-center gap-4 group">
          {/* Logo - Optimized size */}
          <div className="relative w-16 h-16 group-hover:scale-105 transition duration-300">
            <Image
              src="/logo.png"
              alt="Kaos Manga Logo"
              fill
              className="object-contain"
              sizes="64px"
              quality={100}
              priority
            />
          </div>

          <span
            className="text-2xl font-black text-white tracking-widest group-hover:text-purple-400 transition bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500"
            style={{ fontFamily: 'var(--font-cinzel), serif' }} // Yeni Font
          >
            KAOS MANGA
          </span>
        </Link>

        {/* ORTA: LİNKLER */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400">
          <Link href="/" className="hover:text-white transition hover:bg-white/5 px-3 py-2 rounded-md">
            Ana Sayfa
          </Link>
          <Link href="/kesfet" className="hover:text-white transition hover:bg-white/5 px-3 py-2 rounded-md">
            Keşfet
          </Link>
          <Link href="/seriler" className="hover:text-white transition hover:bg-white/5 px-3 py-2 rounded-md">
            Seriler
          </Link>
          <Link href="/yeniler" className="hover:text-white transition hover:bg-white/5 px-3 py-2 rounded-md">
            Yeniler
          </Link>
        </div>

        {/* SAĞ: PROFİL ALANI */}
        <div className="relative">
          {user ? (
            <div>
              <button
                ref={buttonRef}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 py-1.5 px-3 rounded-full border border-gray-700 transition duration-300 focus:outline-none"
              >
                <span className="text-sm font-bold text-gray-200 hidden sm:block max-w-[150px] truncate">
                  {user.username}
                </span>

                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold shadow-md">
                  {user.username ? user.username.charAt(0).toUpperCase() : "U"}
                </div>

                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {/* Dropdown Portal ile render ediliyor - hiçbir overflow veya z-index sorunu yok! */}
              {isDropdownOpen && isMounted && createPortal(
                <div
                  ref={dropdownRef}
                  className="fixed w-64 bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-2xl py-2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-200"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    right: `${dropdownPosition.right}px`
                  }}
                >

                  <div className="px-4 py-2 border-b border-gray-700 mb-1">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-xs text-gray-500">Hesap:</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${user.role === 'admin' ? 'bg-red-900/50 text-red-200 border border-red-800' :
                        user.role === 'editor' ? 'bg-yellow-900/50 text-yellow-200 border border-yellow-800' :
                          'bg-blue-900/50 text-blue-200 border border-blue-800'
                        }`}>
                        {user.role || 'user'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white truncate">{user.username}</p>
                  </div>

                  {/* 👇 GÜNCELLENEN YÖNETİM BUTONLARI 👇 */}
                  {(user.role === "admin" || user.role === "editor") && (
                    <>
                      <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">
                        Webtoon Yönetimi
                      </div>
                      <Link href="/admin/webtoon-ekle" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-1.5 text-sm text-blue-400 hover:bg-gray-800 hover:pl-6 transition-all">
                        📚 Seri Ekle
                      </Link>
                      <Link href="/admin/bolum-ekle" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-1.5 text-sm text-blue-400 hover:bg-gray-800 hover:pl-6 transition-all">
                        🎬 Bölüm Yükle
                      </Link>

                      <div className="px-4 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-2 border-t border-gray-800 pt-2">
                        Roman Yönetimi
                      </div>
                      <Link href="/admin/novel-ekle" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-1.5 text-sm text-purple-400 hover:bg-gray-800 hover:pl-6 transition-all">
                        📖 Roman Ekle
                      </Link>
                      <Link href="/admin/novel-bolum-ekle" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-1.5 text-sm text-purple-400 hover:bg-gray-800 hover:pl-6 transition-all">
                        📝 Roman Bölümü Yükle
                      </Link>
                      <div className="border-t border-gray-700 my-1"></div>
                    </>
                  )}

                  <Link href="/profil" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2">
                    👤 Profilim
                  </Link>

                  <Link
                    href="/favoriler"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                    onClick={() => setIsOpen(false)}
                  >
                    ❤️ Favorilerim
                  </Link>

                  <Link href="/ayarlar" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition">
                    ⚙️ Ayarlar
                  </Link>

                  <div className="border-t border-gray-700 my-1"></div>

                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition text-left">
                    🚪 Çıkış Yap
                  </button>
                </div>,
                document.body
              )}
            </div>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-2 text-gray-400 group hover:text-white transition"
            >
              <span className="text-sm font-medium hidden sm:block">Giriş Yap</span>
              <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center group-hover:border-gray-500 group-hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                </svg>
              </div>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}