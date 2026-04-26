"use client";

import Link from "next/link";

export default function PrivacyPage() {
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
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ffb36b]">Privacy Policy</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Canisterr Privacy</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
            This page explains how user data is handled. Replace this placeholder with your final privacy policy.
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-white/65 sm:text-base">
            <p>We store account data, logs, and social activity needed to run the app.</p>
            <p>We do not sell your personal data.</p>
            <p>You can update or remove your data through your account settings.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
