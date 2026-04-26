"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import { getFullTasteProfile } from "@/lib/friends-match";
import { generateMatchAnalysis } from "@/lib/match-score";
import { getUserByUsername } from "@/lib/profile";
import CinematicLoading from "@/components/CinematicLoading";
import MovieMatchAnalysisView from "@/components/MovieMatchAnalysisView";
import type { User } from "@/types";

export default function MovieMatcherReportPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  const hardRedirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        hardRedirect("/auth/login");
        return;
      }

      try {
        const currentUserRef = ref(db, `users/${firebaseUser.uid}`);
        const currentUserSnapshot = await get(currentUserRef);
        if (!currentUserSnapshot.exists()) {
          hardRedirect("/profile/edit");
          return;
        }

        const currentUserData = currentUserSnapshot.val();
        const currentUserProfile: User = {
          id: currentUserData?.id || firebaseUser.uid,
          username: currentUserData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: currentUserData?.name || firebaseUser.displayName || "User",
          email: currentUserData?.email || firebaseUser.email || undefined,
          avatar_url: currentUserData?.avatar_url || null,
          created_at: currentUserData?.createdAt || new Date().toISOString(),
          bio: currentUserData?.bio || "",
        };

        const viewedProfile = await getUserByUsername(username);
        if (!viewedProfile) {
          hardRedirect("/dashboard");
          return;
        }

        const [currentTastes, viewedTastes] = await Promise.all([
          getFullTasteProfile(currentUserProfile.id),
          getFullTasteProfile(viewedProfile.id),
        ]);

        const report = await generateMatchAnalysis(
          currentTastes,
          viewedTastes,
          currentUserProfile.id,
          viewedProfile.id
        );

        setCurrentUser(currentUserProfile);
        setProfileUser(viewedProfile);
        setAnalysis(report);
      } catch (error) {
        console.error("Error loading match report:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [username]);

  if (loading || !currentUser || !profileUser || !analysis) {
    return <CinematicLoading message="Your match report is loading" />;
  }

  return (
    <MovieMatchAnalysisView
      analysis={analysis}
      viewerName={currentUser.name}
      subjectName={profileUser.name}
      subjectUsername={profileUser.username}
      onBack={() => router.push(`/profile/${profileUser.username}`)}
    />
  );
}
