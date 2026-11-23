import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { SITE_URL } from "@/lib/apiClient";

export default function Breadcrumbs({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: item.href ? `${SITE_URL}${item.href}` : undefined,
    })),
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className="w-full text-xs sm:text-sm text-ink-secondary mb-6 font-sans"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ol className="list-none p-0 inline-flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isFirst = index === 0;
          return (
            <li key={index} className="inline-flex items-center gap-1.5 min-w-0">
              {index > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 text-ink-muted shrink-0"
                  aria-hidden="true"
                />
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1.5 text-ink-secondary hover:text-ink-primary transition-colors"
                >
                  {isFirst && (
                    <Home className="h-3.5 w-3.5 text-ink-muted shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate max-w-[160px] sm:max-w-[240px]">
                    {item.label}
                  </span>
                </Link>
              ) : (
                <span className="text-ink-primary font-medium truncate max-w-[180px] sm:max-w-xs">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
