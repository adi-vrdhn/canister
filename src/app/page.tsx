"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const cachedUser = auth.currentUser;
    if (cachedUser) {
      router.replace("/dashboard");
      setChecked(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      router.replace(firebaseUser ? "/dashboard" : "/auth/login");
      setChecked(true);
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#050505] text-[#f5f0de]">
      <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-white/50">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff7a1a]" />
        {checked ? "Opening Canisterr" : "Checking session"}
      </div>
    </div>
  );
}
