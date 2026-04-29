"use client";

import { useEffect, ReactNode } from "react";

export default function HydrationFix({ children }: { children: ReactNode }) {
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        (args[0].includes("Hydration failed") ||
          args[0].includes("hydrated but some attributes"))
      ) {
        return;
      }
      originalError.call(console, ...args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  return <>{children}</>;
}
