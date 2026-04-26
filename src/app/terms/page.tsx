"use client";

import Link from "next/link";

export default function TermsPage() {
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
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ffb36b]">Terms of Service</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Canisterr Terms</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
            This page explains the rules for using Canisterr. You can replace this placeholder with your final legal text.
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-white/65 sm:text-base">
            <p>Use the app in a lawful and respectful way.</p>
            <p>Do not attempt to abuse, scrape, or disrupt the service.</p>
            <p>We may update these terms as the product changes.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
