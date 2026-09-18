import Link from "next/link";

export default function Breadcrumbs({ items }) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.label,
            item: item.href
                ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://kaosmanga.net"}${item.href}`
                : undefined,
        })),
    };

    return (
        <nav aria-label="Breadcrumb" className="w-full bg-[#161616] border-b border-white/5">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ol className="container mx-auto max-w-7xl px-4 h-12 flex items-center gap-1.5 sm:gap-2 text-[13px] sm:text-sm overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map((item, index) => (
                    <li key={`${item.label}-${index}`} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {index > 0 && (
                            <span className="text-gray-600" aria-hidden="true">
                                /
                            </span>
                        )}
                        {item.href ? (
                            <Link
                                href={item.href}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className="text-white font-medium">{item.label}</span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
