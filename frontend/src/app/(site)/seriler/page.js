import { apiFetch } from "@/lib/apiClient";
import SerilerClient from "./SerilerClient";

export const revalidate = 60;

async function getInitialSeries() {
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
    console.error("Seriler SSR verileri çekilemedi:", err);
    return {
      initialWebtoons: [],
      initialNovels: [],
    };
  }
}

export default async function SerilerPage() {
  const { initialWebtoons, initialNovels } = await getInitialSeries();

  return (
    <SerilerClient
      initialWebtoons={initialWebtoons}
      initialNovels={initialNovels}
    />
  );
}
