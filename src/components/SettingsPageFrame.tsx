"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">{description}</p>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </PageLayout>
  );
}
