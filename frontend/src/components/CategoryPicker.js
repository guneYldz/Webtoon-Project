"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Tag } from "lucide-react";
import { PUBLIC_API_URL, getAdminToken } from "@/lib/apiClient";

export default function CategoryPicker({
  api,
  token,
  selectedIds = [],
  onChange,
}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const baseUrl = (api || PUBLIC_API_URL).replace(/\/+$/, "");
      const authToken = token || getAdminToken();
      try {
        const res = await fetch(`${baseUrl}/admin/categories`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        const data = await res.json();
        if (data.status === "success") {
          setCategories(data.data || []);
        } else if (Array.isArray(data)) {
          setCategories(data);
        }
      } catch (err) {
        console.error("Kategoriler yüklenemedi:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [api, token]);

  const toggle = (id) => {
    if (!onChange) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-ink-muted py-1">
        <Loader2 className="h-4 w-4 animate-spin text-brand" />
        <span>Kategoriler yükleniyor...</span>
      </div>
    );
  }

  if (!categories.length) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-subtle bg-surface px-3.5 py-2 text-sm text-ink-muted">
        <Tag className="h-4 w-4 text-ink-muted" />
        <span>Henüz kategori yok. Önce Admin → Kategoriler’den ekleyin.</span>
      </div>
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
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
              active
                ? "bg-brand/20 text-purple-200 border-brand/50 shadow-sm shadow-purple-950/40"
                : "bg-surface text-ink-secondary border-subtle hover:border-hover hover:text-ink-primary hover:bg-elevated/60"
            }`}
          >
            {active && <Check className="h-3.5 w-3.5 text-brand shrink-0" />}
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
