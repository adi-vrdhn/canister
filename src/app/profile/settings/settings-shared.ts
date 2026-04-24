"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import type { User } from "@/types";

export type ThemePreference = "system" | "light" | "dark";
export type TextSizePreference = "compact" | "comfortable" | "large";
export type VisibilityPreference = "public" | "followers" | "private";
export type FollowPreference = "everyone" | "followers" | "nobody";

export interface SettingsData {
  privacy: {
    profileVisibility: VisibilityPreference;
    followRequests: FollowPreference;
    listVisibility: VisibilityPreference;
    logVisibility: VisibilityPreference;
    activityVisibility: VisibilityPreference;
  };
  notifications: {
    followRequests: boolean;
    likesAndComments: boolean;
    collaborationInvites: boolean;
    matcherUpdates: boolean;
    emailNotifications: boolean;
  };
  appearance: {
    theme: ThemePreference;
    textSize: TextSizePreference;
    reduceMotion: boolean;
  };
  social: {
    shareListsPublicly: boolean;
    showSharedMovies: boolean;
    allowCollaborations: boolean;
    blockedUsers: string[];
  };
  account: {
    status: "active" | "deactivated";
  };
}

export const DEFAULT_SETTINGS: SettingsData = {
  privacy: {
    profileVisibility: "public",
    followRequests: "everyone",
    listVisibility: "public",
    logVisibility: "public",
    activityVisibility: "public",
  },
  notifications: {
    followRequests: true,
    likesAndComments: true,
    collaborationInvites: true,
    matcherUpdates: true,
    emailNotifications: false,
  },
  appearance: {
    theme: "system",
    textSize: "comfortable",
    reduceMotion: false,
  },
  social: {
    shareListsPublicly: true,
    showSharedMovies: true,
    allowCollaborations: true,
    blockedUsers: [],
  },
  account: {
    status: "active",
  },
};

export function mergeSettings(raw: any): SettingsData {
  return {
    privacy: {
      profileVisibility: raw?.privacy?.profileVisibility || DEFAULT_SETTINGS.privacy.profileVisibility,
      followRequests: raw?.privacy?.followRequests || DEFAULT_SETTINGS.privacy.followRequests,
      listVisibility: raw?.privacy?.listVisibility || DEFAULT_SETTINGS.privacy.listVisibility,
      logVisibility: raw?.privacy?.logVisibility || DEFAULT_SETTINGS.privacy.logVisibility,
      activityVisibility: raw?.privacy?.activityVisibility || DEFAULT_SETTINGS.privacy.activityVisibility,
    },
    notifications: {
      followRequests: raw?.notifications?.followRequests ?? DEFAULT_SETTINGS.notifications.followRequests,
      likesAndComments: raw?.notifications?.likesAndComments ?? DEFAULT_SETTINGS.notifications.likesAndComments,
      collaborationInvites: raw?.notifications?.collaborationInvites ?? DEFAULT_SETTINGS.notifications.collaborationInvites,
      matcherUpdates: raw?.notifications?.matcherUpdates ?? DEFAULT_SETTINGS.notifications.matcherUpdates,
      emailNotifications: raw?.notifications?.emailNotifications ?? DEFAULT_SETTINGS.notifications.emailNotifications,
    },
    appearance: {
      theme: raw?.appearance?.theme || DEFAULT_SETTINGS.appearance.theme,
      textSize: raw?.appearance?.textSize || DEFAULT_SETTINGS.appearance.textSize,
      reduceMotion: raw?.appearance?.reduceMotion ?? DEFAULT_SETTINGS.appearance.reduceMotion,
    },
    social: {
      shareListsPublicly: raw?.social?.shareListsPublicly ?? DEFAULT_SETTINGS.social.shareListsPublicly,
      showSharedMovies: raw?.social?.showSharedMovies ?? DEFAULT_SETTINGS.social.showSharedMovies,
      allowCollaborations: raw?.social?.allowCollaborations ?? DEFAULT_SETTINGS.social.allowCollaborations,
      blockedUsers: Array.isArray(raw?.social?.blockedUsers) ? raw.social.blockedUsers : DEFAULT_SETTINGS.social.blockedUsers,
    },
    account: {
      status: raw?.account?.status === "deactivated" ? "deactivated" : "active",
    },
  };
}

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

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
