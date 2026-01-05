"use client";

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // Menü açık mı?
  
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef(null); // Menü dışına tıklamayı algılamak için

  // 1. Token kontrolü
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, [pathname]);

  // 2. Menü dışına tıklayınca kapatma özelliği
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  // 3. Çıkış Yapma Fonksiyonu
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setIsDropdownOpen(false);
    router.push('/login');
  };

  return (
    <nav className="w-full h-16 bg-gray-900 text-white flex items-center justify-between px-6 shadow-md relative z-50">
      
      {/* SOL: LOGO */}
      <div className="text-2xl font-bold text-blue-500">
        <Link href="/">WebtoonTR 🚀</Link>
      </div>

      {/* ORTA: LİNKLER */}
      <div className="space-x-6 hidden md:flex font-medium">
        <Link href="/" className="hover:text-blue-400 transition">Ana Sayfa</Link>
        <Link href="/kesfet" className="hover:text-blue-400 transition">Keşfet</Link>
        <Link href="/kategoriler" className="hover:text-blue-400 transition">Kategoriler</Link>
      </div>

      {/* SAĞ: KULLANICI ALANI */}
      <div className="flex items-center gap-4">
        {isLoggedIn ? (
          // --- GİRİŞ YAPILMIŞSA: PROFİL MENÜSÜ ---
          <div className="relative" ref={dropdownRef}>
            
            {/* Profil Resmi / Butonu */}
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 focus:outline-none"
            >
              <span className="text-sm text-gray-300 hidden sm:block">Hesabım</span>
              {/* Yuvarlak Profil Avatarı (Placeholder) */}
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold border-2 border-gray-700 hover:border-blue-400 transition">
                TR {/* İlerde buraya kullanıcının baş harfleri veya resmi gelecek */}
              </div>
            </button>

            {/* Açılır Menü (Dropdown) */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-3 w-48 bg-white rounded-lg shadow-xl py-2 text-gray-800 border border-gray-100 overflow-hidden animation-fade-in">
                
                {/* Menü Maddeleri */}
                <Link 
                  href="/profil" 
                  className="block px-4 py-2 hover:bg-gray-100 transition flex items-center gap-2"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  👤 Profilim
                </Link>
                
                <Link 
                  href="/ayarlar" 
                  className="block px-4 py-2 hover:bg-gray-100 transition flex items-center gap-2"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  ⚙️ Ayarlar
                </Link>

                <div className="border-t my-1"></div> {/* Çizgi */}

                <button 
                  onClick={handleLogout}
                  className="w-full text-left block px-4 py-2 text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                >
                  🚪 Çıkış Yap
                </button>
              </div>
            )}

          </div>
        ) : (
          // --- GİRİŞ YAPILMAMIŞSA: LOGIN BUTONU ---
          <Link 
            href="/login" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition text-sm font-bold"
          >
            Giriş Yap
          </Link>
        )}
      </div>

    </nav>
  );
}