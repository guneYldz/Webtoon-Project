"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const GSI_SCRIPT_ID = "google-identity-services-sdk";

function GoogleGIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

export default function GoogleSignInButton({
  redirectTo = "/",
  showDivider = true,
  dividerPosition = "top",
  dividerText = "veya",
  label = "Google ile Devam Et",
}) {
  const router = useRouter();
  const tokenClientRef = useRef(null);
  const isMountedRef = useRef(true);
  const redirectToRef = useRef(redirectTo);
  const routerRef = useRef(router);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    redirectToRef.current = redirectTo;
  }, [redirectTo]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const submitAccessToken = useCallback(async (accessToken) => {
    try {
      const res = await apiFetch("/auth/google", {
        method: "POST",
        credentials: "include",
        json: { access_token: accessToken },
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
      routerRef.current.push(redirectToRef.current);
    } catch (err) {
      console.error("Google giriş hatası:", err);
      toast.error(err.message || "Google ile giriş başarısız oldu.");
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  }, []);

  const ensureTokenClient = useCallback(() => {
    if (tokenClientRef.current) return tokenClientRef.current;
    if (
      !GOOGLE_CLIENT_ID ||
      typeof window === "undefined" ||
      !window.google?.accounts?.oauth2?.initTokenClient
    ) {
      return null;
    }

    try {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        callback: (tokenResponse) => {
          if (!isMountedRef.current) return;
          if (tokenResponse?.error || !tokenResponse?.access_token) {
            setSubmitting(false);
            if (tokenResponse?.error && tokenResponse.error !== "access_denied") {
              toast.error("Google ile giriş tamamlanamadı.");
            }
            return;
          }
          submitAccessToken(tokenResponse.access_token);
        },
        error_callback: (err) => {
          if (!isMountedRef.current) return;
          setSubmitting(false);
          if (err?.type === "popup_failed_to_open") {
            toast.error("Google giriş penceresi açılamadı. Açılır pencerelere izin verin.");
          }
        },
      });
      return tokenClientRef.current;
    } catch (err) {
      console.error("Google OAuth2 istemcisi başlatılamadı:", err);
      return null;
    }
  }, [submitAccessToken]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window === "undefined") return;
    if (ensureTokenClient()) return;

    let pollTimer = null;
    let script =
      document.getElementById(GSI_SCRIPT_ID) ||
      document.querySelector('script[src="https://accounts.google.com/gsi/client"]');

    if (!script) {
      script = document.createElement("script");
      script.id = GSI_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const onLoad = () => {
      if (ensureTokenClient() && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    script.addEventListener("load", onLoad);

    let attempts = 0;
    pollTimer = setInterval(() => {
      attempts += 1;
      if (ensureTokenClient() || attempts >= 80) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, 100);

    return () => {
      script?.removeEventListener("load", onLoad);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [ensureTokenClient]);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  const handleGoogleClick = () => {
    if (submitting) return;
    const tokenClient = ensureTokenClient();
    if (!tokenClient) {
      toast.info("Google giriş servisi hazırlanıyor, lütfen birazdan tekrar deneyin.");
      return;
    }

    setSubmitting(true);
    try {
      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch (err) {
      console.error("Google OAuth2 penceresi açılamadı:", err);
      if (isMountedRef.current) setSubmitting(false);
      toast.error("Google giriş penceresi açılamadı.");
    }
  };

  const dividerElement = showDivider && dividerPosition !== "none" && (
    <div className="relative flex items-center justify-center my-5">
      <div className="w-full border-t border-subtle" />
      <span className="bg-surface px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted whitespace-nowrap">
        {dividerText}
      </span>
      <div className="w-full border-t border-subtle" />
    </div>
  );

  return (
    <div className={dividerPosition === "bottom" ? "mb-1" : "mt-1"}>
      {dividerPosition === "top" && dividerElement}

      <button
        type="button"
        onClick={handleGoogleClick}
        disabled={submitting}
        aria-busy={submitting}
        className="group flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-elevated/90 px-4 text-sm font-medium text-ink-primary shadow-sm transition-all duration-200 hover:border-purple-400/50 hover:bg-elevated hover:shadow-[0_0_22px_rgba(168,85,247,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2
              className="h-4 w-4 animate-spin text-brand shrink-0"
              aria-hidden="true"
            />
            <span>Google ile giriş yapılıyor...</span>
          </>
        ) : (
          <>
            <GoogleGIcon />
            <span>{label}</span>
          </>
        )}
      </button>

      {dividerPosition === "bottom" && dividerElement}
    </div>
  );
}
