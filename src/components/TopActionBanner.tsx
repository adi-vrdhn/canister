"use client";

import { CheckCircle2 } from "lucide-react";

export default function TopActionBanner({
  message,
}: {
  message: string | null;
}) {
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-[60] w-[min(34rem,calc(100vw-1rem))] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-[#ff7a1a]/20 bg-[#0f0f0f]/95 px-4 py-3 text-[#f5f0de] shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ff7a1a]/15 text-[#ff7a1a]">
          <CheckCircle2 className="h-4.5 w-4.5" />
        </span>
        <p className="min-w-0 text-sm font-semibold tracking-tight">
          {message}
        </p>
      </div>
    </div>
  );
}
