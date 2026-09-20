"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminDuyurularRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/announcements");
  }, [router]);
  return <p className="p-6 text-gray-500">Duyurular sayfasına yönlendiriliyor...</p>;
}
