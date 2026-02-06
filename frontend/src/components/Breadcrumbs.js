import Link from "next/link";

export default function Breadcrumbs({ items }) {
    // Schema.org BreadcrumbList JSON-LD
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.label,
            "item": item.href ? `http://localhost:3000${item.href}` : undefined, // Update domain in production
        })),
    };

    return (
        <nav
            aria-label="Breadcrumb"
            className="w-full text-sm text-gray-400 mb-6 font-sans bg-[#121212]"
        >
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ol className="list-none p-0 inline-flex flex-wrap gap-2">
                {items.map((item, index) => (
                    <li key={index} className="flex items-center">
                        {index > 0 && <span className="mx-2 text-gray-600">/</span>}
                        {item.href ? (
                            <Link href={item.href} className="hover:text-purple-400 transition">
                                {item.label}
                            </Link>
                        ) : (
                            <span className="text-gray-200 font-medium truncate max-w-[150px] sm:max-w-none">
                                {item.label}
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
