"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface EmailVerificationBadgeProps {
  className?: string;
}

export default function EmailVerificationBadge({ className = "" }: EmailVerificationBadgeProps) {
  const [showBadge, setShowBadge] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const shouldShow = Boolean(firebaseUser && !firebaseUser.emailVerified);
      setShowBadge(shouldShow);
      if (!shouldShow) {
        setStatus("");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;

    try {
      setSending(true);
      setStatus("");
      await sendEmailVerification(auth.currentUser);
      setStatus("Verification email sent. Please check inbox and spam.");
    } catch {
      setStatus("Could not send verification email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!showBadge) return null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-[#f5f0de]">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-[#ff7a1a] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#0a0a0a]">
            Verify Email
          </span>
          <span>Please verify your email to secure your account.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={sending}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10 disabled:opacity-60"
          >
            {sending ? "Sending..." : "Resend Verification"}
          </button>
          <Link
            href="/profile/edit"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10"
          >
            Edit Email
          </Link>
        </div>
      </div>
      {status && <p className="mt-2 text-xs text-white/70">{status}</p>}
    </div>
  );
}
