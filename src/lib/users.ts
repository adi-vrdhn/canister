import { get, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import type { User } from "@/types";
import { createTimedCache } from "@/lib/cache";

type UserRecord = Record<string, unknown> & {
  id?: string;
  username?: string;
  name?: string;
  avatar_url?: string | null;
  created_at?: string;
  createdAt?: string;
};

const PROFILE_TTL_MS = 5 * 60 * 1000;
const ALL_USERS_TTL_MS = 2 * 60 * 1000;

const cachedGetUserProfile = createTimedCache<[string], User | null>({
  ttlMs: PROFILE_TTL_MS,
  key: (userId) => userId,
  loader: async (userId) => {
    const snapshot = await get(ref(db, `users/${userId}`));
    if (!snapshot.exists()) return null;

    const raw = snapshot.val() as UserRecord;
    return {
      id: raw.id || userId,
      username: raw.username || "user",
      name: raw.name || "Unknown",
      avatar_url: raw.avatar_url || null,
      created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
    };
  },
});

const cachedGetAllUsers = createTimedCache<[], Record<string, User>>({
  ttlMs: ALL_USERS_TTL_MS,
  key: () => "all-users",
  loader: async () => {
    const snapshot = await get(ref(db, "users"));
    if (!snapshot.exists()) return {};

    const raw = snapshot.val() as Record<string, UserRecord>;
    return Object.fromEntries(
      Object.entries(raw).map(([id, user]) => [
        id,
        {
          id: user.id || id,
          username: user.username || "user",
          name: user.name || "Unknown",
          avatar_url: user.avatar_url || null,
          created_at: user.created_at || user.createdAt || new Date().toISOString(),
        } satisfies User,
      ])
    );
  },
});

export async function getUserProfile(userId: string): Promise<User> {
  return (
    (await cachedGetUserProfile(userId)) || {
      id: userId,
      username: "user",
      name: "Unknown",
      avatar_url: null,
      created_at: new Date().toISOString(),
    }
  );
}

export async function getUsersByIds(userIds: string[]): Promise<Record<string, User>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const users = await Promise.all(uniqueIds.map(async (userId) => [userId, await getUserProfile(userId)] as const));
  return Object.fromEntries(users);
}

export async function getAllUsersCached(): Promise<Record<string, User>> {
  return (await cachedGetAllUsers()) || {};
}
