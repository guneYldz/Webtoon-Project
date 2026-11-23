"use client";

import { useEffect, useRef, useState } from "react";
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
  const wrapperRef = useRef(null);
  const overlayRef = useRef(null);
  const initializedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [gisReady, setGisReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window === "undefined") return;

    let cancelled = false;
    let pollTimer = null;

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

    const mountGisButton = () => {
      if (
        cancelled ||
        initializedRef.current ||
        !window.google?.accounts?.id ||
        !overlayRef.current
      ) {
        return false;
      }

      try {
        const measuredWidth = wrapperRef.current?.clientWidth || 368;
        const clampedWidth = Math.max(240, Math.min(400, Math.round(measuredWidth)));

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          ux_mode: "popup",
          auto_select: false,
        });

        overlayRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(overlayRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          width: clampedWidth,
          locale: "tr",
        });

        initializedRef.current = true;
        setGisReady(true);
        return true;
      } catch (err) {
        console.error("Google GIS başlatılamadı:", err);
        return false;
      }
    };

    if (mountGisButton()) {
      return () => {
        cancelled = true;
      };
    }

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
      if (mountGisButton() && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    script.addEventListener("load", onLoad);

    let attempts = 0;
    pollTimer = setInterval(() => {
      attempts += 1;
      if (mountGisButton() || attempts >= 80) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, 100);

    return () => {
      cancelled = true;
      initializedRef.current = false;
      script?.removeEventListener("load", onLoad);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [redirectTo, router]);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  const handleFallbackClick = () => {
    if (submitting) return;
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
        return;
      } catch {
        // Fall through to informative toast
      }
    }
    toast.info("Google giriş servisi hazırlanıyor, lütfen tekrar deneyin.");
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

      <div
        ref={wrapperRef}
        className="group relative w-full h-11 rounded-xl overflow-hidden"
      >
        {/* Instant 0ms First-Paint Obsidian Button Surface */}
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={submitting}
          aria-busy={submitting}
          className="relative z-0 flex h-full w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-elevated/90 px-4 text-sm font-medium text-ink-primary shadow-sm transition-all duration-200 group-hover:border-purple-400/50 group-hover:bg-elevated group-hover:shadow-[0_0_22px_rgba(168,85,247,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-60"
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

        {/* Native GIS Click Surface Overlay (100% transparent, full button coverage) */}
        <div
          ref={overlayRef}
          aria-hidden={submitting || !gisReady}
          className={`absolute inset-0 z-10 flex items-center justify-center overflow-hidden opacity-[0.001] scale-110 transition-none [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!min-w-full ${
            submitting || !gisReady
              ? "pointer-events-none"
              : "pointer-events-auto cursor-pointer"
          }`}
        />
      </div>

      {dividerPosition === "bottom" && dividerElement}
    </div>
  );
}
