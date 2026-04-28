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

interface AdTerraTopAdProps {
  className?: string;
  label?: string;
  placementKey?: string | number;
}

export default function AdTerraTopAd({
  className,
  label = "Sponsored",
  placementKey,
}: AdTerraTopAdProps) {
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

  const containerId = placementKey ? `container-6cf1e759750e80b0433baa997f5578fd-${placementKey}` : ADTERRA_CONTAINER_ID;

  return (
    <div className={className || "overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0f0f0f] px-3 py-3 sm:px-4"}>
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
        {label}
      </div>
      <div id={containerId} className="min-h-[6.5rem] w-full" />
    </div>
  );
}
