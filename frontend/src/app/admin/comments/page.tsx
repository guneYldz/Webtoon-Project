"use client";

import { useEffect, useState } from "react";

type CommentRow = {
    id: number;
    content: string;
    username: string;
    created_at?: string | null;
};

export default function AdminCommentsPage() {
    const [items, setItems] = useState<CommentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

    const token = () => sessionStorage.getItem("admin_token");

    const load = async () => {
        const t = token();
        if (!t) {
            window.location.href = "/login-admin";
            return;
        }
        try {
            const res = await fetch(`${API}/admin/comments`, {
                headers: { Authorization: `Bearer ${t}` },
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data.data || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const remove = async (id: number) => {
        if (!confirm("Bu yorumu silmek istiyor musun?")) return;
        const res = await fetch(`${API}/admin/comments/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token()}` },
        });
        const data = await res.json();
        if (data.status === "success") {
            setItems((prev) => prev.filter((item) => item.id !== id));
        } else {
            alert(data.detail || "Silinemedi");
        }
    };

    return (
        <div className="p-6 max-w-5xl">
            <h1 className="text-3xl font-bold mb-6">Yorumlar</h1>
            {loading && <p className="text-gray-500">Yükleniyor...</p>}
            {!loading && (
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    {items.length === 0 ? (
                        <p className="text-center py-8 text-gray-500">Yorum yok.</p>
                    ) : (
                        <ul className="divide-y">
                            {items.map((item) => (
                                <li key={item.id} className="p-4 flex justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold">@{item.username}</p>
                                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{item.content}</p>
                                    </div>
                                    <button onClick={() => remove(item.id)} className="text-red-600 text-sm font-semibold shrink-0">
                                        Sil
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
