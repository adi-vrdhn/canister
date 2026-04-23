"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, PenLine, Upload } from "lucide-react";
import CinematicLoading from "@/components/CinematicLoading";
import PageLayout from "@/components/PageLayout";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import type { User } from "@/types";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        setUser({
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
          bio: userData?.bio || "",
        });
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (loading || !user) {
    return <CinematicLoading message="Profile settings are loading" />;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push(`/profile/${user.username}`)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Profile
          </button>
        </div>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Settings</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Profile settings</h1>
            <p className="mt-2 text-sm text-slate-500">Manage how your profile looks and bring your Letterboxd history into Cineparte.</p>
          </div>

          <div className="space-y-3">
            <Link
              href="/profile/edit"
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                <PenLine className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-950">Edit profile</span>
                <span className="mt-0.5 block text-sm text-slate-500">Update your photo, name, username, email, and bio.</span>
              </span>
            </Link>

            <Link
              href={`/profile/${user.username}?importRatings=1`}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                <Upload className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-950">Import Letterboxd ratings CSV</span>
                <span className="mt-0.5 block text-sm text-slate-500">Upload your Letterboxd ratings export and auto-build your diary.</span>
              </span>
            </Link>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
