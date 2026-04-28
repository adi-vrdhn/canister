"use client";

import { useEffect } from "react";

const ADTERRA_SCRIPT_SRC =
  "https://pl29281203.profitablecpmratenetwork.com/6cf1e759750e80b0433baa997f5578fd/invoke.js";
const ADTERRA_CONTAINER_ID = "container-6cf1e759750e80b0433baa997f5578fd";

let adTerraScriptPromise: Promise<void> | null = null;

function loadAdTerraScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${ADTERRA_SCRIPT_SRC}"]`
  );
  if (existingScript) {
    return Promise.resolve();
  }

  if (!adTerraScriptPromise) {
    adTerraScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.dataset.cfasync = "false";
      script.src = ADTERRA_SCRIPT_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load AdTerra script"));
      document.head.appendChild(script);
    });
  }

  return adTerraScriptPromise;
}

export default function AdTerraTopAd() {
  useEffect(() => {
    let cancelled = false;

    loadAdTerraScript().catch((error) => {
      if (!cancelled) {
        console.warn("AdTerra script failed:", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0f0f0f] px-3 py-3 sm:px-4">
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
        Sponsored
      </div>
      <div id={ADTERRA_CONTAINER_ID} className="min-h-[6.5rem] w-full" />
    </div>
  );
}
