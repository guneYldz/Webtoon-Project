"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: E-posta Gir, 2: Kod ve Yeni Şifre Gir
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Adım 1: Kod İste
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        const res = await fetch(`${API}/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        
        if (res.ok) {
            alert("Sıfırlama kodu terminale (simülasyon) gönderildi. Lütfen konsolu kontrol edin.");
            setStep(2);
        } else {
            const err = await res.json();
            alert(err.detail);
        }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // Adım 2: Şifreyi Sıfırla
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        const res = await fetch(`${API}/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: code, new_password: newPassword })
        });
        
        if (res.ok) {
            alert("Şifreniz başarıyla sıfırlandı! Giriş yapabilirsiniz.");
            router.push("/login");
        } else {
            const err = await res.json();
            alert(err.detail || "Kod hatalı.");
        }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#121212] p-8 rounded-3xl border border-gray-800 shadow-2xl">
            <h2 className="text-2xl font-black text-white text-center mb-2">Şifremi Unuttum 🆘</h2>
            <p className="text-gray-500 text-center text-sm mb-8">Hesabını kurtaralım.</p>

            {step === 1 ? (
                <form onSubmit={handleRequestCode} className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-400 font-bold uppercase ml-1">E-posta Adresin</label>
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-[#1a1a1a] rounded-xl border border-gray-700 text-white focus:border-purple-600 outline-none mt-1" placeholder="ornek@site.com" />
                    </div>
                    <button disabled={loading} className="w-full py-3 bg-purple-600 rounded-xl text-white font-bold hover:bg-purple-500 transition">{loading ? "Gönderiliyor..." : "Sıfırlama Kodu Gönder"}</button>
                </form>
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-400 font-bold uppercase ml-1">Sıfırlama Kodu (Terminalden Bak)</label>
                        <input type="text" required value={code} onChange={e => setCode(e.target.value)} className="w-full p-3 bg-[#1a1a1a] rounded-xl border border-gray-700 text-white focus:border-purple-600 outline-none mt-1" placeholder="Kodu buraya yapıştır" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400 font-bold uppercase ml-1">Yeni Şifre</label>
                        <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-3 bg-[#1a1a1a] rounded-xl border border-gray-700 text-white focus:border-purple-600 outline-none mt-1" placeholder="Yeni şifreniz" />
                    </div>
                    <button disabled={loading} className="w-full py-3 bg-green-600 rounded-xl text-white font-bold hover:bg-green-500 transition">{loading ? "Sıfırlanıyor..." : "Şifreyi Sıfırla"}</button>
                </form>
            )}

            <div className="mt-6 text-center">
                <Link href="/login" className="text-gray-500 text-sm hover:text-white transition">Giriş Ekranına Dön</Link>
            </div>
        </div>
    </div>
  );
}
