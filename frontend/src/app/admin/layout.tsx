"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 🔥 Mobil menü durumu

    useEffect(() => {
        // Token kontrolü - sadece client-side'da çalışır
        const checkAuth = () => {
            const token = sessionStorage.getItem("admin_token");
            const role = sessionStorage.getItem("admin_role");
            const user = sessionStorage.getItem("admin_user");

            if (!token || role !== "admin") {
                // Token yok veya admin değil - login'e yönlendir
                router.push("/login-admin");
                setLoading(false);
                return;
            }

            // Token var ve admin - authenticated yap
            setUsername(user || "Admin");
            setAuthenticated(true);
            setLoading(false);
        };

        checkAuth();
    }, []); // Boş dependency array - sadece mount'ta çalışır

    const handleLogout = () => {
        sessionStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_role");
        sessionStorage.removeItem("admin_user");
        router.push("/login-admin");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-500">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return null;
    }

    return (
        <div className="flex h-[100dvh] max-h-[100dvh] bg-gray-100 font-sans text-gray-900 overflow-hidden fixed inset-0">

            {/* MOBİL ARKAKAPLAN (Overlay) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* SIDEBAR */}
            <aside
                className={`w-64 bg-gray-900 text-white flex flex-col shadow-xl fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 h-full min-h-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <div className="p-6 border-b border-gray-800">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Admin Panel
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">Webtoon & Manga & Novel</p>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
                    <NavItem href="/admin" icon="📊" label="Dashboard" onNavigate={() => setIsSidebarOpen(false)} />

                    <div className="pt-4 pb-1 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        İçerik Yönetimi
                    </div>
                    <NavItem href="/admin/webtoons" icon="🎨" label="Webtoon & Manga" onNavigate={() => setIsSidebarOpen(false)} />
                    <NavItem href="/admin/webtoon-bolumleri" icon="🎬" label="Bölümler (Webtoon/Manga)" onNavigate={() => setIsSidebarOpen(false)} />
                    <NavItem href="/admin/novels" icon="📖" label="Noveller" onNavigate={() => setIsSidebarOpen(false)} />
                    <NavItem href="/admin/novel-bolumleri" icon="📑" label="Novel Bölümleri" onNavigate={() => setIsSidebarOpen(false)} />
                    <NavItem href="/admin/categories" icon="📂" label="Kategoriler" onNavigate={() => setIsSidebarOpen(false)} />

                    <div className="pt-4 pb-1 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        Bölüm Ekle
                    </div>
                    <NavItem href="/admin/bolum-ekle?series_type=WEBTOON" icon="➕" label="Webtoon Bölüm Ekle" onNavigate={() => setIsSidebarOpen(false)} />
                    <NavItem href="/admin/bolum-ekle?series_type=MANGA" icon="➕" label="Manga Bölüm Ekle" onNavigate={() => setIsSidebarOpen(false)} />
                    <NavItem href="/admin/novel-bolum-ekle" icon="➕" label="Novel Bölüm Ekle" onNavigate={() => setIsSidebarOpen(false)} />



                    <div className="pt-4 pb-1 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        Kullanıcılar
                    </div>
                    <NavItem href="/admin/users" icon="👥" label="Üyeler" onNavigate={() => setIsSidebarOpen(false)} />
                    <NavItem href="/admin/comments" icon="💬" label="Yorumlar" onNavigate={() => setIsSidebarOpen(false)} />
                    <NavItem href="/admin/announcements" icon="📢" label="Duyurular" onNavigate={() => setIsSidebarOpen(false)} />
                </nav>

                <div className="p-4 border-t border-gray-800 space-y-2">
                    <div className="px-4 py-2 text-sm text-gray-400">
                        👤 {username}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <span>🚪</span>
                        <span>Çıkış Yap</span>
                    </button>
                    <Link href="/" className="flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-white transition-colors">
                        <span>🏠</span>
                        <span>Siteye Dön</span>
                    </Link>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
                <header className="bg-white shadow-sm h-16 min-h-[4rem] flex items-center px-4 md:px-8 justify-between z-10 w-full shrink-0">
                    <div className="flex items-center gap-4">
                        {/* 🍔 HAMBURGER BUTONU (Sadece Mobilde) */}
                        <button
                            className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <h2 className="text-xl font-semibold text-gray-800">Yönetim Paneli</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {username.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>
                <div className="admin-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 md:p-8 bg-gray-50">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavItem({ href, icon, label, onNavigate }: { href: string; icon: string; label: string; onNavigate?: () => void }) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200 group"
        >
            <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
            <span className="font-medium">{label}</span>
        </Link>
    );
}
