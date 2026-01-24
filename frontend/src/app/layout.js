import "./globals.css";
import Navbar from "@/components/Navbar"; // 1. Navbar'ı çağırdık (Import)

export const metadata = {
  title: {
    default: "Webtoon & Novel Dünyası",
    template: "%s | Site Adın", // Alt sayfalarda "Shadow Slave | Site Adın" yazar
  },
  description: "En sevilen Webtoon ve Novelleri Türkçe ve ücretsiz oku.",
  keywords: ["webtoon", "novel", "türkçe manga", "shadow slave oku", "oku"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        {/* 2. Navbar'ı en tepeye koyduk */}
        <Navbar />
        
        {/* 3. Sayfanın geri kalanı (Çocuklar) buraya gelecek */}
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
