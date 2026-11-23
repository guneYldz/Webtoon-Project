"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const GSI_SCRIPT_ID = "google-identity-services-sdk";

export default function GoogleSignInButton({
  redirectTo = "/",
  showDivider = true,
}) {
  const router = useRouter();
  const buttonContainerRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window === "undefined") return;

    let cancelled = false;

    const handleCredentialResponse = async (response) => {
      if (!response?.credential || cancelled) return;
      setSubmitting(true);
      try {
        const res = await apiFetch("/auth/google", {
          method: "POST",
          credentials: "include",
          json: { credential: response.credential },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || "Google ile giriş yapılamadı.");
        }

        if (data.access_token) {
          window.localStorage.setItem("token", data.access_token);
        }
        const role = data.role || data.user?.role;
        const username = data.username || data.user?.username;
        if (role) window.localStorage.setItem("role", role);
        if (username) window.localStorage.setItem("username", username);

        window.dispatchEvent(new Event("auth-change"));
        toast.success(`Hoş geldin, ${username || "Okuyucu"}!`);
        router.push(redirectTo);
      } catch (err) {
        console.error("Google giriş hatası:", err);
        toast.error(err.message || "Google ile giriş başarısız oldu.");
      } finally {
        if (!cancelled) setSubmitting(false);
      }
    };

    const initializeGoogleButton = () => {
      if (
        cancelled ||
        !window.google?.accounts?.id ||
        !buttonContainerRef.current
      ) {
        return;
      }
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          ux_mode: "popup",
          auto_select: false,
        });

        buttonContainerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
          width: 340,
          locale: "tr",
        });
      } catch (err) {
        console.error("Google GSI başlatılamadı:", err);
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogleButton();
    } else {
      let script = document.getElementById(GSI_SCRIPT_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = GSI_SCRIPT_ID;
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", initializeGoogleButton);
      return () => {
        cancelled = true;
        script?.removeEventListener("load", initializeGoogleButton);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [redirectTo, router]);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  return (
    <div className="mt-5">
      {showDivider && (
        <div className="relative flex items-center justify-center my-5">
          <div className="w-full border-t border-subtle" />
          <span className="bg-surface px-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            veya
          </span>
          <div className="w-full border-t border-subtle" />
        </div>
      )}

      <div className="relative flex flex-col items-center justify-center min-h-[44px]">
        <div
          ref={buttonContainerRef}
          className={`flex justify-center transition-opacity ${
            submitting ? "opacity-40 pointer-events-none" : "opacity-100"
          }`}
        />
        {submitting && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-semibold text-ink-primary">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            <span>Google ile giriş yapılıyor...</span>
          </div>
        )}
      </div>
    </div>
  );
}
