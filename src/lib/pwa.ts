"use client";

import { useEffect, useState } from "react";

export function detectStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;

  const nav = navigator as Navigator & { standalone?: boolean };
  const displayModeStandalone =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;

  return Boolean(displayModeStandalone || nav.standalone || document.referrer.startsWith("android-app://"));
}

export function useIsPwa(): boolean {
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    const update = () => setIsPwa(detectStandalonePwa());
    update();

    const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(display-mode: standalone)") : null;
    mediaQuery?.addEventListener?.("change", update);
    window.addEventListener("focus", update);
    window.addEventListener("visibilitychange", update);

    return () => {
      mediaQuery?.removeEventListener?.("change", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("visibilitychange", update);
    };
  }, []);

  return isPwa;
}
