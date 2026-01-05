import Link from 'next/link'; // Sayfalar arası geçiş için Next.js'in özel linki

export default function Navbar() {
  return (
    // <nav>: Bu kutunun bir navigasyon barı olduğunu tarayıcıya söyler (SEO için iyi)
    // w-full: Genişlik full olsun.
    // h-16: Yükseklik belirli bir boyutta olsun (64px).
    // bg-gray-900: Arka plan koyu gri olsun.
    // text-white: Yazılar beyaz olsun.
    // flex items-center justify-between: İçindekileri hizala (Biri sağa, biri sola).
    // px-6: Kenarlardan biraz boşluk bırak.
    <nav className="w-full h-16 bg-gray-900 text-white flex items-center justify-between px-6">
      
      {/* SOL TARAF: LOGO */}
      <div className="text-2xl font-bold text-blue-500">
        <Link href="/">WebtoonTR 🚀</Link>
      </div>

      {/* ORTA TARAF: LİNKLER */}
      <div className="space-x-6 hidden md:flex">
        <Link href="/" className="hover:text-blue-400">Ana Sayfa</Link>
        <Link href="/kesfet" className="hover:text-blue-400">Keşfet</Link>
        <Link href="/kategoriler" className="hover:text-blue-400">Kategoriler</Link>
      </div>

      {/* SAĞ TARAF: BUTONLAR */}
      <div>
        <Link 
          href="/login" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition"
        >
          Giriş Yap
        </Link>
      </div>

    </nav>
  );
}