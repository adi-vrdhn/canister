"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, Sparkles } from "lucide-react";
import PersonalityCard from "@/components/PersonalityCard";
import CinematicLoading from "@/components/CinematicLoading";
import { auth, db } from "@/lib/firebase";
import { getPersonalityCard, getUserByUsername } from "@/lib/profile";
import type { User } from "@/types";

export default function MoviePersonalityPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  const hardRedirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const [loading, setLoading] = useState(true);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [personalityCard, setPersonalityCard] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        hardRedirect("/auth/login");
        return;
      }

      try {
        const currentUserRef = ref(db, `users/${firebaseUser.uid}`);
        const currentUserSnapshot = await get(currentUserRef);
        const currentUserData = currentUserSnapshot.val();
        const currentUserId = currentUserData?.id || firebaseUser.uid;

        if (!currentUserSnapshot.exists()) {
          hardRedirect("/dashboard");
          return;
        }

        const profile = await getUserByUsername(username);
        if (!profile) {
          hardRedirect("/dashboard");
          return;
        }

        if (profile.id !== currentUserId) {
          hardRedirect(`/profile/${profile.username}`);
          return;
        }

        const card = await getPersonalityCard(profile.id);

        setProfileUser(profile);
        setPersonalityCard(card);
      } catch (error) {
        console.error("Error loading movie personality page:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [username, router]);

  if (loading || !profileUser) {
    return <CinematicLoading message="Movie personality is loading" />;
  }

  return (
    <div className="brutalist min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,122,26,0.18),_rgba(10,10,10,0.98)_42%,_#050505_100%)] text-[#f5f0de]">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href={`/profile/${profileUser.username}`}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Link>

        <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#f5f0de]" />
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              {profileUser.name}&apos;s Movie Personality
            </h1>
          </div>
          <p className="mt-2 text-sm text-zinc-600">A quick look at taste style, loved genres, and vibe split.</p>
        </section>

        {personalityCard ? (
          <PersonalityCard
            title={personalityCard.title}
            loves={personalityCard.loves}
            avoids={personalityCard.avoids}
            vibeHollywood={personalityCard.vibeHollywood}
            vibeBollywood={personalityCard.vibeBollywood}
          />
        ) : (
          <section className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-zinc-600">
            No personality data available yet.
          </section>
        )}
      </div>
    </div>
  );
}
