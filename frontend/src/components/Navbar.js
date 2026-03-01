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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      const res = await fetch("https://kaosmanga.net/api/auth/me", {
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

  // Scroll kilidi - Mobil menü açıkken arka plan kaymasın
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isMobileMenuOpen]);

  // ESC tuşu ile kapatma
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      window.addEventListener("keydown", handleEsc);
    }
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isMobileMenuOpen]);

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

        {/* SOL: HAMBURGER & LOGO */}
        <div className="flex items-center gap-2">
          {/* HAMBURGER BUTONU (Mobil) */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden text-gray-400 hover:text-white transition p-2 -ml-2"
            aria-label="Menüyü Aç"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <Link href="/" title="Kaos Manga - Ana Sayfa" className="flex items-center gap-4 group">
            {/* Logo - Optimized size */}
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 group-hover:scale-105 transition duration-300">
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
              className="text-xl sm:text-2xl font-black text-white tracking-widest group-hover:text-purple-400 transition bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500 hidden sm:block"
              style={{ fontFamily: 'var(--font-cinzel), serif' }}
            >
              KAOS MANGA
            </span>
          </Link>
        </div>

        {/* ORTA: LİNKLER */}
        <div className="hidden md:flex items-center gap-6 text-base font-medium text-gray-400">
          <Link href="/" title="Ana Sayfa" className="hover:text-white transition hover:bg-white/5 px-3 py-2 rounded-md">
            Ana Sayfa
          </Link>
          <Link href="/kesfet" title="Webtoon ve Novel Keşfet" className="hover:text-white transition hover:bg-white/5 px-3 py-2 rounded-md">
            Keşfet
          </Link>
          <Link href="/seriler" title="Tüm Seriler" className="hover:text-white transition hover:bg-white/5 px-3 py-2 rounded-md">
            Seriler
          </Link>
          <Link href="/yeniler" title="Yeni Eklenen Seriler" className="hover:text-white transition hover:bg-white/5 px-3 py-2 rounded-md">
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
                <span className="text-base font-bold text-gray-200 hidden sm:block max-w-[150px] truncate">
                  {user.username}
                </span>

                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-400 to-blue-500 flex items-center justify-center text-white text-base font-bold shadow-md">
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
                      <p className="text-base text-gray-500">Hesap:</p>
                      <span className={`text-base px-1.5 py-0.5 rounded font-bold uppercase ${user.role === 'admin' ? 'bg-red-900/50 text-red-200 border border-red-800' :
                        user.role === 'editor' ? 'bg-yellow-900/50 text-yellow-200 border border-yellow-800' :
                          'bg-blue-900/50 text-blue-200 border border-blue-800'
                        }`}>
                        {user.role || 'user'}
                      </span>
                    </div>
                    <p className="text-base font-bold text-white truncate">{user.username}</p>
                  </div>

                  {/* 👇 GÜNCELLENEN YÖNETİM BUTONLARI 👇 */}
                  {(user.role === "admin" || user.role === "editor") && (
                    <>
                      <div className="px-4 py-1 text-base font-bold text-gray-500 uppercase tracking-wider mt-1">
                        Webtoon Yönetimi
                      </div>
                      <Link href="/admin/webtoon-ekle" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-1.5 text-base text-blue-400 hover:bg-gray-800 hover:pl-6 transition-all">
                        📚 Seri Ekle
                      </Link>
                      <Link href="/admin/bolum-ekle" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-1.5 text-base text-blue-400 hover:bg-gray-800 hover:pl-6 transition-all">
                        🎬 Bölüm Yükle
                      </Link>

                      <div className="px-4 py-1 text-base font-bold text-gray-500 uppercase tracking-wider mt-2 border-t border-gray-800 pt-2">
                        Roman Yönetimi
                      </div>
                      <Link href="/admin/novel-ekle" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-1.5 text-base text-purple-400 hover:bg-gray-800 hover:pl-6 transition-all">
                        📖 Roman Ekle
                      </Link>
                      <Link href="/admin/novel-bolum-ekle" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-1.5 text-base text-purple-400 hover:bg-gray-800 hover:pl-6 transition-all">
                        📝 Roman Bölümü Yükle
                      </Link>
                      <div className="border-t border-gray-700 my-1"></div>
                    </>
                  )}

                  <Link href="/profil" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-2 text-base text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2">
                    👤 Profilim
                  </Link>

                  <Link
                    href="/favoriler"
                    className="block px-4 py-2 text-base text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                    onClick={() => setIsOpen(false)}
                  >
                    ❤️ Favorilerim
                  </Link>

                  <Link href="/ayarlar" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-base text-gray-300 hover:bg-gray-800 hover:text-white transition">
                    ⚙️ Ayarlar
                  </Link>

                  <div className="border-t border-gray-700 my-1"></div>

                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-base text-red-400 hover:bg-red-900/20 hover:text-red-300 transition text-left">
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
              <span className="text-base font-medium hidden sm:block">Giriş Yap</span>
              <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center group-hover:border-gray-500 group-hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                </svg>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* MOBİL MENÜ OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] md:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* MOBİL MENÜ YAN PANEL */}
      <div className={`fixed top-0 left-0 w-[280px] h-full bg-[#1a1a1a] border-r border-gray-800 z-[2001] md:hidden transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <span
              className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500"
              style={{ fontFamily: 'var(--font-cinzel), serif' }}
            >
              KAOS MANGA
            </span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-400 hover:text-white p-1"
              aria-label="Menüyü Kapat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/" title="Ana Sayfa" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition py-3 px-2 rounded-lg hover:bg-white/5 flex items-center gap-3">
              🏠 Ana Sayfa
            </Link>
            <Link href="/kesfet" title="Webtoon ve Novel Keşfet" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition py-3 px-2 rounded-lg hover:bg-white/5 flex items-center gap-3">
              🔍 Keşfet
            </Link>
            <Link href="/seriler" title="Tüm Seriler" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition py-3 px-2 rounded-lg hover:bg-white/5 flex items-center gap-3">
              📚 Seriler
            </Link>
            <Link href="/yeniler" title="Yeni Eklenen Seriler" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition py-3 px-2 rounded-lg hover:bg-white/5 flex items-center gap-3">
              ✨ Yeniler
            </Link>
          </div>

          <div className="mt-auto border-t border-gray-800 pt-6">
            {!user ? (
              <button
                onClick={() => { setIsMobileMenuOpen(false); router.push("/login"); }}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-purple-500/20 transition active:scale-95"
              >
                Giriş Yap
              </button>
            ) : (
              <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-400 to-blue-500 flex items-center justify-center text-white font-bold">
                  {user.username ? user.username.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-base font-bold text-white truncate">{user.username}</span>
                  <span className="text-base text-gray-500 capitalize">{user.role || 'user'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}