"use client";

import { Loader2 } from "lucide-react";

type CinematicLoadingProps = {
  message?: string;
};

export default function CinematicLoading({
  message = "Your page is loading",
}: CinematicLoadingProps) {
  return (
    <div className="relative flex min-h-dvh w-screen items-center justify-center overflow-hidden px-4 text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,122,26,0.22),_transparent_30%),radial-gradient(circle_at_80%_18%,_rgba(255,173,89,0.14),_transparent_26%),linear-gradient(180deg,_#140c08_0%,_#120b07_54%,_#090504_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.06),_transparent_30%,_rgba(255,255,255,0.03)_58%,_transparent_82%)] opacity-70" />
      <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-[#ff7a1a]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 right-0 h-72 w-72 rounded-full bg-[#ff9c4a]/15 blur-3xl" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <div className="relative mb-8 flex h-40 w-40 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#ff7a1a]/20 bg-white/5 shadow-[0_0_80px_rgba(255,122,26,0.2)] backdrop-blur-2xl" />
          <div className="absolute inset-3 rounded-full border border-white/5 bg-black/20" />
          <div className="absolute inset-6 rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10" />
          <Loader2 className="relative z-10 h-14 w-14 animate-spin text-[#ff7a1a]" strokeWidth={2.4} />
        </div>

        <div className="w-full rounded-[2rem] border border-white/10 bg-white/[0.08] p-6 text-center shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="mx-auto flex w-fit items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 shadow-[0_0_24px_rgba(255,122,26,0.28)]">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-[#ffb36b] border-t-transparent animate-spin" />
            </div>
            <p className="brand-wordmark text-4xl font-bold tracking-tight text-[#fff2e1] sm:text-5xl">
              Canisterr
            </p>
          </div>

          <p className="mt-4 text-base font-semibold text-[#fff2e1]">{message}</p>
          <p className="mt-2 text-sm text-[#ffcf9d]/80">Buffering your scene with a warm orange glow.</p>

          <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="cinematic-loading-bar h-full w-1/2 rounded-full bg-gradient-to-r from-[#ff7a1a] via-[#ff9c4a] to-[#ffd08a]" />
          </div>

          <p className="mt-5 text-[11px] text-white/40">Loading content in the background while the interface settles.</p>
        </div>
      </div>
    </div>
  );
}
