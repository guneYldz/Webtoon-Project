"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function UsersListPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({});

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // 1. Token'ı al
            const token = localStorage.getItem("access_token") ||
                localStorage.getItem("admin_token") ||
                localStorage.getItem("token");

            console.log("🔍 DEBUG: Fetching users with token:", token ? "Exists" : "MISSING");

            if (!token) {
                window.location.href = "/login-admin";
                return;
            }

            const params = new URLSearchParams({ page: page.toString(), limit: "20" });
            if (search) params.append("search", search);
            if (roleFilter) params.append("role", roleFilter);

            const res = await fetch(`${API}/api/admin/users?${params}`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            console.log("🔍 DEBUG: Users response status:", res.status);

            if (res.ok) {
                const data = await res.json();
                if (data.status === "success") {
                    setUsers(data.data);
                    setPagination(data.pagination);
                }
            } else {
                console.error("❌ Kullanıcı listesi yüklenemedi. Status:", res.status);
                if (res.status === 401) {
                    alert("Oturum süresi dolmuş veya yetkiniz yok. Lütfen tekrar giriş yapın.");
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("admin_token");
                    window.location.href = "/login-admin";
                }
            }
        } catch (error) {
            console.error("❌ Kullanıcı listesi yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [page, roleFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchUsers();
    };

    const toggleBan = async (userId, currentStatus) => {
        try {
            const form = new FormData();
            form.append("is_active", (!currentStatus).toString());

            const res = await fetch(`${API}/api/admin/users/${userId}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
                },
                body: form
            });
            const data = await res.json();
            if (data.status === "success") {
                alert(data.message);
                fetchUsers();
            }
        } catch (error) {
            alert("Hata: " + error.message);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Kullanıcılar</h1>
            </div>

            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <form onSubmit={handleSearch} className="flex gap-4 flex-wrap">
                    <input
                        type="text"
                        placeholder="Kullanıcı veya email ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg"
                    />
                    <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="px-4 py-2 border rounded-lg">
                        <option value="">Tüm Roller</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900">Ara</button>
                </form>
            </div>

            {loading && <div className="text-center py-8"><p className="text-gray-500">Yükleniyor...</p></div>}

            {!loading && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kullanıcı Adı</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{user.id}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.username}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded-full ${user.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.is_active ? <span className="text-green-600">✓ Aktif</span> : <span className="text-red-600">⛔ Yasaklı</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => toggleBan(user.id, user.is_active)}
                                            className={`text-sm ${user.is_active ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}`}
                                        >
                                            {user.is_active ? "Yasakla" : "Yasağı Kaldır"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && <div className="text-center py-8 text-gray-500">Kullanıcı yok.</div>}
                </div>
            )}

            {pagination.pages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border rounded-lg disabled:opacity-50">Önceki</button>
                    <span className="px-4 py-2">Sayfa {page} / {pagination.pages}</span>
                    <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="px-4 py-2 border rounded-lg disabled:opacity-50">Sonraki</button>
                </div>
            )}
        </div>
    );
}
