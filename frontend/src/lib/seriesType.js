export function seriesTypeLabel(type, typeLabel) {
  const raw = String(typeLabel || type || "WEBTOON").toUpperCase();
  if (raw.includes("NOVEL")) return "NOVEL";
  if (raw.includes("MANGA")) return "MANGA";
  return "WEBTOON";
}

export function seriesTypeBadgeClass(type, typeLabel) {
  const label = seriesTypeLabel(type, typeLabel);
  if (label === "NOVEL") return "bg-purple-600";
  if (label === "MANGA") return "bg-orange-600";
  return "bg-blue-600";
}

export function seriesTypeTextClass(type, typeLabel) {
  const label = seriesTypeLabel(type, typeLabel);
  if (label === "NOVEL") return "text-purple-500";
  if (label === "MANGA") return "text-orange-400";
  return "text-blue-500";
}

export function seriesTypePillClass(type, typeLabel) {
  const label = seriesTypeLabel(type, typeLabel);
  if (label === "NOVEL") return "bg-purple-600/20 text-purple-400 border-purple-600/50";
  if (label === "MANGA") return "bg-orange-600/20 text-orange-400 border-orange-600/50";
  return "bg-blue-600/20 text-blue-400 border-blue-600/50";
}
