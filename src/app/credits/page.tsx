"use client";

import Link from "next/link";

export default function CreditsPage() {
  return (
    <main className="min-h-dvh bg-[#090909] px-4 py-10 text-[#f5f0de] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/profile/settings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition hover:text-[#ffb36b]"
        >
          Back to settings
        </Link>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-8">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Credits</h1>
          <div className="mt-6 space-y-3 text-sm leading-7 text-white/70 sm:text-base">
            <p>
              Movies and TV metadata provided by{" "}
              <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="font-semibold text-[#ffb36b] hover:underline">
                TMDb
              </a>
              .
            </p>
            <p>
              TV show data provided by{" "}
              <a href="https://www.tvmaze.com" target="_blank" rel="noreferrer" className="font-semibold text-[#ffb36b] hover:underline">
                TVmaze
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
