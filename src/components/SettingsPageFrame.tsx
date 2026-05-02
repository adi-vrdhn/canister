"use client";

import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import type { ReactNode } from "react";
import type { User } from "@/types";

export default function SettingsPageFrame({
  user,
  loading,
  onSignOut,
  title,
  description,
  children,
  backHref = "/profile/settings",
}: {
  user: User | null;
  loading: boolean;
  onSignOut: () => void | Promise<void>;
  title: string;
  description: string;
  children?: ReactNode;
  backHref?: string;
}) {
  if (loading || !user) {
    return <CinematicLoading message="Your settings are loading" />;
  }

  return (
    <PageLayout user={user} onSignOut={onSignOut}>
      <div className="mx-auto max-w-3xl px-4 py-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-10">
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition hover:text-[#ffb36b]">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-[#f5f0de] sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/60">{description}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              void onSignOut();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10 hover:text-[#ffb36b] sm:self-start"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </PageLayout>
  );
}
