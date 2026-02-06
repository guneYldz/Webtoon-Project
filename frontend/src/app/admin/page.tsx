"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        total_webtoons: 0,
        total_users: 0,
        total_views: 0,
        total_novels: 0,
        published_webtoons: 0,
        published_novels: 0,
        total_comments: 0
    });

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    useEffect(() => {
        async function fetchStats() {
            // 1. Token'ı al
            const token = localStorage.getItem("access_token") ||
                localStorage.getItem("admin_token") ||
                localStorage.getItem("token");

            if (!token) {
                window.location.href = "/login-admin";
                return;
            }

            try {
                // 2. İsteğe Header ekle
                const res = await fetch(`${API}/api/admin/stats`, {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });

                if (res.status === 401) {
                    // Token geçersizse login'e at
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("admin_token");
                    window.location.href = "/login-admin";
                    return;
                }

                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "success") {
                        setStats(data.data);
                    } else {
                        setStats(data);
                    }
                }
            } catch (error) {
                console.error("Stats yüklenemedi:", error);
            }
        }

        fetchStats();
    }, []);

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Admin Paneli</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* İstatistik Kartları */}
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-gray-500 text-sm font-medium">Toplam Webtoon</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_webtoons || 0}</p>
                    <p className="text-xs text-green-600 mt-1">{stats.published_webtoons || 0} Yayında</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-gray-500 text-sm font-medium">Toplam Novel</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_novels || 0}</p>
                    <p className="text-xs text-green-600 mt-1">{stats.published_novels || 0} Yayında</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-gray-500 text-sm font-medium">Toplam Kullanıcı</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_users || 0}</p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-xl font-bold mb-4">Hızlı İşlemler</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link href="/admin/webtoon-ekle" className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
                        <span className="text-3xl">🎨</span>
                        <span className="font-semibold text-gray-700">Yeni Webtoon Ekle</span>
                    </Link>
                    <Link href="/admin/novel-ekle" className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
                        <span className="text-3xl">📖</span>
                        <span className="font-semibold text-gray-700">Yeni Novel Ekle</span>
                    </Link>
                    <Link href="/admin/categories" className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all">
                        <span className="text-3xl">📂</span>
                        <span className="font-semibold text-gray-700">Kategorileri Yönet</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
