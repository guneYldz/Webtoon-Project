'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateWebtoonPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        summary: '',
        status: 'ongoing',
        is_published: false
    });

    const [files, setFiles] = useState<{ cover: File | null; banner: File | null }>({
        cover: null,
        banner: null
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: checked }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'banner') => {
        if (e.target.files && e.target.files[0]) {
            setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('summary', formData.summary);
            data.append('status', formData.status);
            data.append('is_published', String(formData.is_published)); // Backend boolean bekliyor ama form-data string gider

            if (files.cover) data.append('cover_image', files.cover);
            if (files.banner) data.append('banner_image', files.banner);

            //   const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'; 
            // Development ortamında proxy ayarı yoksa tam URL gerekebilir. 
            // Ancak Next.js rewrites kullanıyorsak /api yeterli. Şimdilik direct backend'e atalım.
            const API_URL = 'http://localhost:8000/api/admin/webtoon/create';

            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                body: data,
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.detail || 'Bir hata oluştu');
            }

            setMessage({ type: 'success', text: 'Webtoon başarıyla oluşturuldu! Yönlendiriliyorsunuz...' });

            // Reset form
            setFormData({ title: '', summary: '', status: 'ongoing', is_published: false });
            setFiles({ cover: null, banner: null });

            // Redirect after short delay
            //   setTimeout(() => router.push('/admin'), 2000);

        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Beklenmedik bir hata oluştu.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Yeni Webtoon Ekle</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                {message && (
                    <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Webtoon Başlığı</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="Örn: Solo Leveling"
                        />
                    </div>

                    {/* Summary */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Özet / Açıklama</label>
                        <textarea
                            name="summary"
                            value={formData.summary}
                            onChange={handleInputChange}
                            required
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            placeholder="Webtoon konusunu buraya yazın..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="ongoing">Devam Ediyor (Ongoing)</option>
                                <option value="completed">Tamamlandı (Completed)</option>
                                <option value="hiatus">Ara Verildi (Hiatus)</option>
                            </select>
                        </div>

                        {/* Published Checkbox */}
                        <div className="flex items-center pt-8">
                            <input
                                type="checkbox"
                                id="is_published"
                                name="is_published"
                                checked={formData.is_published}
                                onChange={handleCheckboxChange}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            />
                            <label htmlFor="is_published" className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                                Webtoon Yayında Olsun mu? (Public)
                            </label>
                        </div>
                    </div>

                    {/* Images */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Kapak Resmi (Dikey)</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition cursor-pointer relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, 'cover')}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="space-y-2">
                                    <span className="text-3xl">🖼️</span>
                                    <p className="text-sm text-gray-500">{files.cover ? files.cover.name : "Resim Seç veya Sürükle"}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Banner Resmi (Yatay)</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition cursor-pointer relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, 'banner')}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="space-y-2">
                                    <span className="text-3xl">🌄</span>
                                    <p className="text-sm text-gray-500">{files.banner ? files.banner.name : "Resim Seç veya Sürükle"}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-6">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-3 px-4 rounded-lg text-white font-bold text-lg shadow-md transition-all
                ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-1'}
              `}
                        >
                            {isLoading ? 'Kaydediliyor...' : 'Webtoon Oluştur 🚀'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
