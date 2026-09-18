import SocialIcon from "@/components/SocialIcons";
import { socialLinks } from "@/data/socialLinks";

const BRAND_STYLES = {
  discord: {
    iconWrap: "bg-[#5865F2]/15 text-[#5865F2] group-hover:bg-[#5865F2] group-hover:text-white",
    border: "hover:border-[#5865F2]/80 hover:shadow-[#5865F2]/20",
    button: "bg-[#5865F2] hover:bg-[#4752C4]",
  },
  instagram: {
    iconWrap: "bg-pink-500/15 text-pink-400 group-hover:bg-gradient-to-br group-hover:from-yellow-400 group-hover:via-pink-500 group-hover:to-purple-600 group-hover:text-white",
    border: "hover:border-pink-500/70 hover:shadow-pink-500/20",
    button: "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600",
  },
  youtube: {
    iconWrap: "bg-red-500/15 text-red-500 group-hover:bg-red-600 group-hover:text-white",
    border: "hover:border-red-500/70 hover:shadow-red-500/20",
    button: "bg-red-600 hover:bg-red-500",
  },
  tiktok: {
    iconWrap: "bg-white/10 text-white group-hover:bg-white group-hover:text-black",
    border: "hover:border-white/40 hover:shadow-white/10",
    button: "bg-white text-black hover:bg-gray-200",
  },
  twitter: {
    iconWrap: "bg-white/10 text-white group-hover:bg-white group-hover:text-black",
    border: "hover:border-white/40 hover:shadow-white/10",
    button: "bg-white text-black hover:bg-gray-200",
  },
  x: {
    iconWrap: "bg-white/10 text-white group-hover:bg-white group-hover:text-black",
    border: "hover:border-white/40 hover:shadow-white/10",
    button: "bg-white text-black hover:bg-gray-200",
  },
};

function ExternalArrow() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17L17 7M17 7H9M17 7v8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SocialCard({ link }) {
  const style = BRAND_STYLES[link.id] || BRAND_STYLES.discord;
  const isLive = Boolean(link.href);

  const content = (
    <>
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center transition duration-300 ${
          isLive ? style.iconWrap : "bg-white/5 text-gray-500"
        }`}
      >
        <SocialIcon id={link.id} className="w-8 h-8" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white">{link.name}</h2>
          {!isLive && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
              Yakında
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1">{link.description}</p>
      </div>

      {isLive ? (
        <span
          className={`inline-flex items-center gap-2 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition ${style.button}`}
        >
          {link.cta || "Aç"}
          <ExternalArrow />
        </span>
      ) : (
        <span className="text-sm text-gray-500 font-medium">Yakında eklenecek</span>
      )}
    </>
  );

  const className = `group flex flex-col sm:flex-row sm:items-center gap-5 p-6 rounded-2xl border bg-[#1a1a1a] transition duration-300 ${
    isLive
      ? `border-gray-800 ${style.border} hover:shadow-lg hover:-translate-y-0.5`
      : "border-gray-800/70 opacity-70 cursor-not-allowed"
  }`;

  if (!isLive) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${link.name} — ${link.cta || "Aç"}`}
      className={className}
    >
      {content}
    </a>
  );
}

export default function BaglantilarPage() {
  return (
    <div className="min-h-screen bg-[#121212] pb-20 font-sans">
      <div className="bg-[#1a1a1a] border-b border-gray-800 pt-10 pb-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
            <span className="bg-gradient-to-r from-purple-500 to-blue-500 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg text-xl">
              🔗
            </span>
            Bağlantılar
          </h1>
          <p className="text-gray-400 text-sm">
            Discord sunucumuz ve diğer sosyal medya hesaplarımız.
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-10">
        <div
          className={`grid gap-6 ${
            socialLinks.length === 1
              ? "max-w-xl"
              : "grid-cols-1 md:grid-cols-2 max-w-4xl"
          }`}
        >
          {socialLinks.map((link) => (
            <SocialCard key={link.id} link={link} />
          ))}
        </div>
      </div>
    </div>
  );
}
