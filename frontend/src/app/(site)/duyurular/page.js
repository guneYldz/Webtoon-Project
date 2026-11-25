import { apiFetch } from "@/lib/apiClient";
import DuyurularClient from "./DuyurularClient";

export const revalidate = 60;

async function getInitialAnnouncements() {
  try {
    const res = await apiFetch("/notifications/announcements", {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Duyurular SSR verisi çekilemedi:", err);
    return [];
  }
}

export default async function DuyurularPage() {
  const initialItems = await getInitialAnnouncements();

  return <DuyurularClient initialItems={initialItems} />;
}
