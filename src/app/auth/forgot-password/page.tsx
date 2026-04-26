"use client";

import { useState } from "react";
import Link from "next/link";
import { sendResetPasswordEmail } from "@/lib/auth";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import AuthMobileCard from "@/components/AuthMobileCard";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await sendResetPasswordEmail(email);
      setSuccess("Password reset email sent. Please check your inbox and spam folder.");
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else {
        setError("Could not send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#090909] px-4 py-6 text-[#f5f0de] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center">
        <AuthMobileCard
          mode="forgot"
          title="Forgot password"
          subtitle="Enter your email and we will send a reset link."
          footer={
            <>
              <Link href="/auth/login" className="font-semibold text-[#ffb36b] hover:text-[#ff8d3b]">
                Back to sign in
              </Link>
            </>
          }
        >
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#ff7a1a]/25 bg-[#ff7a1a]/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ffb36b]" />
              <p className="text-sm text-[#f5f0de]">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
              <p className="text-sm text-[#f5f0de]">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#f5f0de]/75">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#151515] py-3 pl-10 pr-4 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/45 focus:ring-2 focus:ring-[#ff7a1a]/15"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#ff7a1a] py-3 text-sm font-black text-[#0a0a0a] transition hover:bg-[#ff8d3b] disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </AuthMobileCard>
      </div>
    </div>
  );
}
