"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import CinematicLoading from "@/components/CinematicLoading";

export default function ProfileRedirectPage() {
  const [loading, setLoading] = useState(true);

  const hardRedirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        hardRedirect("/auth/login");
        return;
      }

      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const username = userData?.username || "user";
        hardRedirect(`/profile/${username}`);
      } catch (error) {
        console.error("Error redirecting to profile:", error);
        hardRedirect("/");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return <CinematicLoading message="Redirecting to your profile" />;
}
