"use client";

import { useEffect, useState } from "react";

export default function CategoryPicker({ api, token, selectedIds, onChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${api}/admin/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.status === "success") setCategories(data.data || []);
      } catch (err) {
        console.error("Kategoriler yüklenemedi:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [api, token]);

  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Kategoriler yükleniyor...</p>;
  }

  if (!categories.length) {
    return (
      <p className="text-sm text-gray-500">
        Henüz kategori yok. Önce Admin → Kategoriler’den ekleyin.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const active = selectedIds.includes(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => toggle(cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${
              active
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-gray-50 text-gray-700 border-gray-300 hover:border-purple-400"
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
