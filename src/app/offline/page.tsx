"use client";

import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#090909] px-4 text-[#f5f0de]">
      <div className="w-full max-w-md border border-white/10 bg-[#111111] p-6 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ffb36b]">Offline</p>
        <h1 className="mt-3 text-3xl font-black">You&apos;re offline</h1>
        <p className="mt-3 text-sm leading-6 text-[#f5f0de]/65">
          Canisterr needs a connection to load your feed, but the app shell is ready for install and can open again once you&apos;re back online.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-[#ff7a1a] px-4 py-2 text-sm font-black text-[#0a0a0a] transition hover:bg-[#ff8d3b]"
          >
            Try again
          </button>
          <Link href="/dashboard" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-[#f5f0de] transition hover:bg-white/5">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
