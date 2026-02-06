"use client"; // Kullanıcı etkileşimi olduğu için şart

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Sayfa değiştirmek için gerekli

export default function RegisterPage() {
  const router = useRouter(); // Yönlendirme servisini çağırdık

  // Hafızada tutacağımız veriler (Login'den farklı olarak username de var)
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Kayıt Verileri:", formData);
    
    // Şimdilik sadece uyarı verelim, sonra backend'e bağlayacağız
    alert("Kayıt ol butonuna basıldı! Backend bağlantısı bir sonraki adımda.");
    
    // İşlem başarılıymış gibi giriş sayfasına yönlendirelim
    // router.push("/login"); 
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Aramıza Katıl! 🚀
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 1. Kullanıcı Adı Kutusu (YENİ) */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              name="username"
              placeholder="CoolReader123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              onChange={handleChange}
              required
            />
          </div>

          {/* 2. Email Kutusu */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              E-posta Adresi
            </label>
            <input
              type="email"
              name="email"
              placeholder="ornek@mail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              onChange={handleChange}
              required
            />
          </div>

          {/* 3. Şifre Kutusu */}
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Şifre
            </label>
            <input
              type="password"
              name="password"
              placeholder="******"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              onChange={handleChange}
              required
            />
          </div>

          {/* Kayıt Butonu */}
          <button
            type="submit"
            className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition duration-200"
          >
            Kayıt Ol
          </button>
        
        </form>

        {/* Giriş Yap Linki */}
        <p className="mt-4 text-center text-gray-600 text-sm">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="text-blue-500 hover:underline">
            Giriş Yap
          </Link>
        </p>

      </div>
    </div>
  );
}