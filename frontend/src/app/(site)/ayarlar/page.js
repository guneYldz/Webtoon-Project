import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hesap Ayarları",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  redirect("/profil?tab=ayarlar");
}
