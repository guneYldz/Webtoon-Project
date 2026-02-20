"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { API } from "@/api";

export default function RecommendedSeries({ type = "novel" }) {
    const [recommendations, setRecommendations] = useState([]);

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                const apiUrl = API || "http://127.0.0.1:8000";
                // Fetch list of series based on type
                // Note: Ideally backend should have a /recommendations endpoint. 
                // For now, we fetch latest/all and pick random.
                const endpoint = type === "novel" ? "/novels/" : "/webtoons/";

                const res = await fetch(`${apiUrl}${endpoint}`, { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    // Shuffle and pick 3 items
                    const shuffled = data.sort(() => 0.5 - Math.random());
                    setRecommendations(shuffled.slice(0, 3));
                }
            } catch (error) {
                console.error("Failed to load recommendations", error);
            }
        };

        fetchRecommendations();
    }, [type]);

    if (recommendations.length === 0) return null;

    return (
        <div className="my-16 border-t border-gray-800 pt-8">
            <h3 className="text-xl font-bold text-gray-200 mb-6 flex items-center gap-2">
                <span>✨</span> Bunları da Beğenebilirsiniz
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {recommendations.map((item) => (
                    <Link
                        key={item.id}
                        href={`/${type}/${item.slug}`}
                        className="group block bg-[#1a1a1a] rounded-lg overflow-hidden border border-gray-800 hover:border-purple-500/50 transition"
                    >
                        <div className="relative aspect-[2/3] w-full bg-gray-900">
                            {item.cover_image && (
                                <Image
                                    src={`${API}/${item.cover_image}`}
                                    alt={item.title}
                                    width={200}
                                    height={300}
                                    unoptimized={true}
                                    className="object-cover group-hover:scale-105 transition duration-500"
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 200px"
                                    style={{ width: '100%', height: 'auto' }}
                                />
                            )}
                        </div>
                        <div className="p-4">
                            <h4 className="text-sm font-bold text-gray-200 line-clamp-1 group-hover:text-purple-400 transition">
                                {item.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                <span>⭐ {item.rating || "4.5"}</span>
                                <span>👁️ {item.view_count || 0}</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
