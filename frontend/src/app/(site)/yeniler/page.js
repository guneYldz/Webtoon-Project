import { apiFetch } from "@/lib/apiClient";
import YenilerClient from "./YenilerClient";

export const revalidate = 60;

async function getInitialNewest() {
  try {
    const fetchOpts = { next: { revalidate: 60 } };
    const [webtoonRes, novelRes] = await Promise.all([
      apiFetch("/webtoons/?limit=1000", fetchOpts).catch(() => null),
      apiFetch("/novels/?limit=1000", fetchOpts).catch(() => null),
    ]);

    const initialWebtoons =
      webtoonRes && webtoonRes.ok ? await webtoonRes.json() : [];
    const initialNovels =
      novelRes && novelRes.ok ? await novelRes.json() : [];

    return {
      initialWebtoons: Array.isArray(initialWebtoons) ? initialWebtoons : [],
      initialNovels: Array.isArray(initialNovels) ? initialNovels : [],
    };
  } catch (err) {
    console.error("Yeniler SSR verileri çekilemedi:", err);
    return {
      initialWebtoons: [],
      initialNovels: [],
    };
  }
}

export default async function YenilerPage() {
  const { initialWebtoons, initialNovels } = await getInitialNewest();

  return (
    <YenilerClient
      initialWebtoons={initialWebtoons}
      initialNovels={initialNovels}
    />
  );
}
