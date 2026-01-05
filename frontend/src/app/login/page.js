"use client"; // 1. Bu satır ŞART! (Aşağıda açıklayacağım)

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  // Kullanıcının yazdıklarını hafızada tutmak için "State" kullanıyoruz
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Kullanıcı kutucuğa bir şey yazdıkça bu çalışır ve hafızayı günceller
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // "Giriş Yap" butonuna basınca bu çalışır
  const handleSubmit = (e) => {
    e.preventDefault(); // Sayfanın yenilenmesini engeller
    console.log("Gönderilecek Veriler:", formData);
    alert("Giriş butonuna basıldı! Backend bağlantısı bir sonraki adımda yapılacak.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      
      {/* Beyaz Kart Kutusu */}
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Tekrar Hoşgeldin! 👋
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Email Kutusu */}
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
            />
          </div>

          {/* Şifre Kutusu */}
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
            />
          </div>

          {/* Giriş Butonu */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition duration-200"
          >
            Giriş Yap
          </button>
        
        </form>

        {/* Kayıt Ol Linki */}
        <p className="mt-4 text-center text-gray-600 text-sm">
          Hesabın yok mu?{" "}
          <Link href="/register" className="text-blue-500 hover:underline">
            Kayıt Ol
          </Link>
        </p>

      </div>
    </div>
  );
}