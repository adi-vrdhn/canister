"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface GoogleAdSlotProps {
  className?: string;
  label?: string;
}

let adsenseScriptPromise: Promise<void> | null = null;

const ADSENSE_SCRIPT_SELECTOR = 'script[data-cine-adsense="true"], script[src*="adsbygoogle.js"]';

function loadAdSenseScript(client: string) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const existingScript = document.querySelector<HTMLScriptElement>(ADSENSE_SCRIPT_SELECTOR);
  if (existingScript) {
    return Promise.resolve();
  }

  if (!adsenseScriptPromise) {
    adsenseScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      script.dataset.cineAdsense = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google AdSense script"));
      document.head.appendChild(script);
    });
  }

  return adsenseScriptPromise;
}

export default function GoogleAdSlot({ className, label = "Advertisement" }: GoogleAdSlotProps) {
  const client = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_IN_FEED;

  useEffect(() => {
    if (!client || !slot) return;

    let cancelled = false;

    loadAdSenseScript(client)
      .then(() => {
        if (cancelled) return;

        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (error) {
          console.warn("Google AdSense render failed:", error);
        }
      })
      .catch((error) => {
        console.warn("Google AdSense script failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [client, slot]);

  if (!client || !slot) {
    return (
      <div
        className={`flex min-h-[7rem] items-center justify-center border border-dashed border-white/10 bg-white/5 px-4 text-center text-xs uppercase tracking-[0.2em] text-white/35 ${
          className || ""
        }`}
      >
        {label}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">{label}</div>
      <ins
        className="adsbygoogle block min-h-[7rem] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
