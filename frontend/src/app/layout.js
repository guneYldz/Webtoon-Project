import "./globals.css";
import Navbar from "@/components/Navbar"; // 1. Navbar'ı çağırdık (Import)

export const metadata = {
  title: "Webtoon Projesi",
  description: "En sevdiğin webtoonları oku!",
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