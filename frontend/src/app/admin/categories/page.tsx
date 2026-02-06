"use client";

import { useState, useEffect } from "react";

export default function CategoriesPage() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState("");

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const fetchCategories = async () => {
        try {
            // 1. Token'ı al
            const token = localStorage.getItem("access_token") ||
                localStorage.getItem("admin_token") ||
                localStorage.getItem("token");

            console.log("🔍 DEBUG: Fetching categories with token:", token ? "Exists" : "MISSING");

            if (!token) {
                window.location.href = "/login-admin";
                return;
            }

            const res = await fetch(`${API}/api/admin/categories`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            console.log("🔍 DEBUG: Categories response status:", res.status);

            if (res.ok) {
                const data = await res.json();
                if (data.status === "success") {
                    setCategories(data.data);
                }
            } else {
                console.error("❌ Kategoriler yüklenemedi. Status:", res.status);
                if (res.status === 401) {
                    alert("Oturum süresi dolmuş veya yetkiniz yok. Lütfen tekrar giriş yapın.");
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("admin_token");
                    window.location.href = "/login-admin";
                }
            }
        } catch (error) {
            console.error("❌ Kategoriler yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        try {
            const form = new FormData();
            form.append("name", newCategoryName);

            const res = await fetch(`${API}/api/admin/categories`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
                },
                body: form
            });
            const data = await res.json();
            if (data.status === "success") {
                alert(data.message);
                setNewCategoryName("");
                fetchCategories();
            }
        } catch (error) {
            alert("Hata: " + error.message);
        }
    };

    const handleUpdate = async (id) => {
        try {
            const form = new FormData();
            form.append("name", editingName);

            const res = await fetch(`${API}/api/admin/categories/${id}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
                },
                body: form
            });
            const data = await res.json();
            if (data.status === "success") {
                alert(data.message);
                setEditingId(null);
                fetchCategories();
            }
        } catch (error) {
            alert("Güncelleme hatası: " + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Bu kategoriyi silmek istediğinden emin misin?")) return;

        try {
            const res = await fetch(`${API}/api/admin/categories/${id}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
                }
            });
            const data = await res.json();
            if (data.status === "success") {
                alert(data.message);
                fetchCategories();
            }
        } catch (error) {
            alert("Silme hatası: " + error.message);
        }
    };

    return (
        <div className="p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Kategoriler</h1>

            {/* Yeni Kategori Ekleme */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-lg font-semibold mb-4">Yeni Kategori Ekle</h2>
                <form onSubmit={handleCreate} className="flex gap-4">
                    <input
                        type="text"
                        placeholder="Kategori adı..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 px-4 py-2 border rounded-lg"
                        required
                    />
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                        Ekle
                    </button>
                </form>
            </div>

            {/* Kategori Listesi */}
            {loading && <div className="text-center py-8"><p className="text-gray-500">Yükleniyor...</p></div>}

            {!loading && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori Adı</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {categories.map((cat) => (
                                <tr key={cat.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{cat.id}</td>
                                    <td className="px-6 py-4">
                                        {editingId === cat.id ? (
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                className="px-3 py-1 border rounded"
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {editingId === cat.id ? (
                                            <>
                                                <button
                                                    onClick={() => handleUpdate(cat.id)}
                                                    className="text-green-600 hover:text-green-800 text-sm"
                                                >
                                                    Kaydet
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="text-gray-600 hover:text-gray-800 text-sm"
                                                >
                                                    İptal
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setEditingId(cat.id);
                                                        setEditingName(cat.name);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                                >
                                                    Düzenle
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cat.id)}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    Sil
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {categories.length === 0 && <div className="text-center py-8 text-gray-500">Henüz kategori yok.</div>}
                </div>
            )}
        </div>
    );
}
