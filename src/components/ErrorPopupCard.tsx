"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCw, X } from "lucide-react";

type ErrorPopupCardProps = {
  title: string;
  message: string;
  details?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
  retryLabel?: string;
  homeHref?: string;
};

export default function ErrorPopupCard({
  title,
  message,
  details,
  onRetry,
  onClose,
  retryLabel = "Try again",
  homeHref = "/dashboard",
}: ErrorPopupCardProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111111] text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
        <div className="flex items-start justify-between border-b border-white/10 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ff7a1a] text-black">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ffb36b]">Error</p>
              <h2 className="mt-1 text-lg font-black">{title}</h2>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 p-2 text-white/55 transition hover:bg-white/5 hover:text-[#f5f0de]"
              aria-label="Close error popup"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-3 p-4">
          <p className="text-sm leading-6 text-white/70">{message}</p>
          {details && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-white/50">{details}</p>}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/10 p-4">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-black text-black transition hover:bg-[#ff8c39]"
            >
              <RotateCw className="h-4 w-4" />
              {retryLabel}
            </button>
          )}
          <Link
            href={homeHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-black text-[#f5f0de] transition hover:bg-white/5"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
