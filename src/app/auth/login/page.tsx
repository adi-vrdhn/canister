"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { AlertCircle } from "lucide-react";


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex flex-col justify-center flex-1 px-8 sm:px-16 md:px-24 lg:px-32 bg-white">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center justify-center mt-12 mb-10">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 uppercase">CANISTER</h1>
          </div>
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Welcome back</h2>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email or Username</label>
              <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your email or username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your password" />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="rounded border-gray-300" />
                Remember for 30 days
              </label>
              <Link href="/auth/forgot-password" className="text-blue-600 hover:underline text-sm font-medium">Forgot password</Link>
            </div>
            <button type="submit" disabled={loading} className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow">{loading ? "Signing in..." : "Sign in"}</button>
            {/* Google sign-in removed */}
          </form>
          <div className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-blue-600 hover:underline font-medium">Sign up</Link>
          </div>
        </div>
      </div>
      {/* Right: Image/Quote */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="https://image.tmdb.org/t/p/original/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg"
            alt="La La Land (2016) Poster"
            className="w-4/5 h-4/5 object-cover rounded-3xl shadow-lg"
          />
        </div>
        <div className="absolute bottom-8 left-8 right-8 text-white text-xl font-semibold drop-shadow-lg">
          <span className="bg-black bg-opacity-40 px-4 py-2 rounded-lg">La la land</span>
        </div>
      </div>
    </div>
  );
}
