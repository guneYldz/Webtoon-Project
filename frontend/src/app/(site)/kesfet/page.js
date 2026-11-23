import { apiFetch } from "@/lib/apiClient";
import KesfetClient from "./KesfetClient";

export const revalidate = 60;

async function getInitialCatalog() {
  try {
    const fetchOpts = { next: { revalidate: 60 } };
    const [webtoonRes, novelRes, catRes] = await Promise.all([
      apiFetch("/webtoons/?limit=1000", fetchOpts).catch(() => null),
      apiFetch("/novels/?limit=1000", fetchOpts).catch(() => null),
      apiFetch("/categories", fetchOpts).catch(() => null),
    ]);

    const initialWebtoons =
      webtoonRes && webtoonRes.ok ? await webtoonRes.json() : [];
    const initialNovels =
      novelRes && novelRes.ok ? await novelRes.json() : [];
    const initialCategories =
      catRes && catRes.ok ? await catRes.json() : [];

    return {
      initialWebtoons: Array.isArray(initialWebtoons) ? initialWebtoons : [],
      initialNovels: Array.isArray(initialNovels) ? initialNovels : [],
      initialCategories: Array.isArray(initialCategories)
        ? initialCategories
        : initialCategories?.data || [],
    };
  } catch (err) {
    console.error("Keşfet SSR verileri çekilemedi:", err);
    return {
      initialWebtoons: [],
      initialNovels: [],
      initialCategories: [],
    };
  }
}

export default async function KesfetPage() {
  const { initialWebtoons, initialNovels, initialCategories } =
    await getInitialCatalog();

  return (
    <KesfetClient
      initialWebtoons={initialWebtoons}
      initialNovels={initialNovels}
      initialCategories={initialCategories}
    />
  );
}
