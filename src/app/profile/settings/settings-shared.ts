"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import type { User } from "@/types";
import { DEFAULT_SETTINGS, mergeSettings, normalizeUsername, type SettingsData } from "@/lib/settings";

export { DEFAULT_SETTINGS, mergeSettings, normalizeUsername } from "@/lib/settings";
export type { SettingsData } from "@/lib/settings";

export function useSettingsUser() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const snapshot = await get(userRef);
        const raw = snapshot.val();

        setUser({
          id: raw?.id || firebaseUser.uid,
          username: raw?.username || firebaseUser.email?.split("@")[0] || "user",
          name: raw?.name || firebaseUser.displayName || "User",
          avatar_url: raw?.avatar_url || null,
          created_at: raw?.createdAt || new Date().toISOString(),
          bio: raw?.bio || "",
          display_list_id: raw?.display_list_id || undefined,
          mood_tags: raw?.mood_tags || [],
          mood_tags_updated_at: raw?.mood_tags_updated_at,
        });
        setSettings(mergeSettings(raw?.settings));
      } catch (error) {
        console.error("Error loading settings user:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.cineTheme = settings.appearance.theme;
    root.dataset.cineTextSize = settings.appearance.textSize;
    root.dataset.cineReduceMotion = settings.appearance.reduceMotion ? "true" : "false";
    root.style.colorScheme = settings.appearance.theme === "dark" ? "dark" : "light";
  }, [settings.appearance]);

  const saveSettings = async (nextSettings: SettingsData) => {
    if (!user) return;

    const previousSettings = settingsRef.current;
    setSettings(nextSettings);
    settingsRef.current = nextSettings;

    try {
      await update(ref(db, `users/${user.id}`), {
        settings: nextSettings,
        settings_updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      setSettings(previousSettings);
      settingsRef.current = previousSettings;
      throw error;
    }
  };

  const updateSection = async <K extends keyof SettingsData>(
    key: K,
    patch: Partial<SettingsData[K]>
  ) => {
    const next = {
      ...settingsRef.current,
      [key]: {
        ...settingsRef.current[key],
        ...patch,
      },
    } as SettingsData;

    await saveSettings(next);
  };

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
    router.push("/auth/login");
  };

  return {
    user,
    settings,
    setSettings,
    loading,
    saveSettings,
    updateSection,
    handleSignOut,
  };
}
