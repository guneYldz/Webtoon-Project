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

    useEffect(() => {
        // Token kontrolü - sadece client-side'da çalışır
        const checkAuth = () => {
            const token = localStorage.getItem("admin_token");
            const role = localStorage.getItem("admin_role");
            const user = localStorage.getItem("admin_user");

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
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_role");
        localStorage.removeItem("admin_user");
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
        <div className="flex h-screen bg-gray-100 font-sans text-gray-900">
            {/* SIDEBAR */}
            <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
                <div className="p-6 border-b border-gray-800">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Admin Panel
                    </h1>
                    <p className="text-xs text-gray-400 mt-1">Webtoon & Novel Manager</p>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <NavItem href="/admin" icon="📊" label="Dashboard" />

                    <div className="pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        İçerik Yönetimi
                    </div>
                    <NavItem href="/admin/webtoons" icon="🎨" label="Webtoonlar" />
                    <NavItem href="/admin/webtoon-bolumleri" icon="🎬" label="Webtoon Bölümleri" />
                    <NavItem href="/admin/novels" icon="📖" label="Noveller" />
                    <NavItem href="/admin/novel-bolumleri" icon="📑" label="Novel Bölümleri" />
                    <NavItem href="/admin/categories" icon="📂" label="Kategoriler" />



                    <div className="pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Kullanıcılar
                    </div>
                    <NavItem href="/admin/users" icon="👥" label="Üyeler" />
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
            <main className="flex-1 overflow-auto max-h-screen">
                <header className="bg-white shadow-sm h-16 flex items-center px-8 justify-between sticky top-0 z-10">
                    <h2 className="text-xl font-semibold text-gray-800">Yönetim Paneli</h2>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {username.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200 group"
        >
            <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
            <span className="font-medium">{label}</span>
        </Link>
    );
}
