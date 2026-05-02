"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import type { User } from "@/types";
import { DEFAULT_SETTINGS, mergeSettings, type SettingsData } from "@/lib/settings";

type CurrentUserContextValue = {
  user: User | null;
  settings: SettingsData;
  loading: boolean;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

function buildFallbackUser(firebaseUser: {
  uid: string;
  displayName: string | null;
  email: string | null;
}): User {
  return {
    id: firebaseUser.uid,
    username: firebaseUser.email?.split("@")[0] || "user",
    name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.exists() ? userSnapshot.val() : null;

        setSettings(mergeSettings(userData?.settings));
        setUser({
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: userData?.name || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.created_at || userData?.createdAt || new Date().toISOString(),
          bio: userData?.bio || "",
          display_list_id: userData?.display_list_id || undefined,
          mood_tags: userData?.mood_tags || [],
          mood_tags_updated_at: userData?.mood_tags_updated_at,
        });
      } catch {
        setSettings(DEFAULT_SETTINGS);
        setUser(buildFallbackUser(firebaseUser));
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      settings,
      loading,
    }),
    [user, settings, loading]
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider");
  }

  return context;
}
