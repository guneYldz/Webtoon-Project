"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const checkAuth = () => {
            const token = sessionStorage.getItem("admin_token");
            const role = sessionStorage.getItem("admin_role");
            const user = sessionStorage.getItem("admin_user");

            if (!token || role !== "admin") {
                router.push("/login-admin");
                setLoading(false);
                return;
            }

            setUsername(user || "Admin");
            setAuthenticated(true);
            setLoading(false);
        };

        checkAuth();
    }, [router]);

    const handleLogout = () => {
        sessionStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_role");
        sessionStorage.removeItem("admin_user");
        router.push("/login-admin");
    };

    const closeSidebar = () => setIsSidebarOpen(false);

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

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-20 md:hidden"
                    onClick={closeSidebar}
                />
            )}

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

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0">
                    <NavItem href="/admin" icon="📊" label="Dashboard" onNavigate={closeSidebar} />

                    <div className="pt-4 pb-1 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        İçerik Yönetimi
                    </div>
                    <NavItem href="/admin/webtoons" icon="🎨" label="Webtoon & Manga" onNavigate={closeSidebar} />
                    <SubNavItem href="/admin/webtoon-ekle?series_type=WEBTOON" label="Webtoon Ekle" onNavigate={closeSidebar} />
                    <SubNavItem href="/admin/webtoon-ekle?series_type=MANGA" label="Manga Ekle" onNavigate={closeSidebar} />
                    <SubNavItem href="/admin/bolum-ekle?series_type=WEBTOON" label="Webtoon Bölüm Ekle" onNavigate={closeSidebar} />
                    <SubNavItem href="/admin/bolum-ekle?series_type=MANGA" label="Manga Bölüm Ekle" onNavigate={closeSidebar} />
                    <NavItem href="/admin/webtoon-bolumleri" icon="🎬" label="Bölümler (Webtoon/Manga)" onNavigate={closeSidebar} />

                    <NavItem href="/admin/novels" icon="📖" label="Noveller" onNavigate={closeSidebar} />
                    <SubNavItem href="/admin/novel-ekle" label="Novel Ekle" onNavigate={closeSidebar} />
                    <SubNavItem href="/admin/novel-bolum-ekle" label="Novel Bölüm Ekle" onNavigate={closeSidebar} />
                    <NavItem href="/admin/novel-bolumleri" icon="📑" label="Novel Bölümleri" onNavigate={closeSidebar} />
                    <NavItem href="/admin/categories" icon="📂" label="Kategoriler" onNavigate={closeSidebar} />

                    <div className="pt-4 pb-1 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        Kullanıcılar
                    </div>
                    <NavItem href="/admin/users" icon="👥" label="Üyeler" onNavigate={closeSidebar} />
                    <NavItem href="/admin/comments" icon="💬" label="Yorumlar" onNavigate={closeSidebar} />
                    <NavItem href="/admin/announcements" icon="📢" label="Duyurular" onNavigate={closeSidebar} />
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

            <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
                <header className="bg-white shadow-sm h-16 min-h-[4rem] flex items-center px-4 md:px-8 justify-between z-10 w-full shrink-0">
                    <div className="flex items-center gap-4">
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

function SubNavItem({ href, label, onNavigate }: { href: string; label: string; onNavigate?: () => void }) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-2 ml-4 pl-4 pr-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors border-l border-gray-700"
        >
            <span className="text-green-400 font-bold">+</span>
            <span>{label}</span>
        </Link>
    );
}
