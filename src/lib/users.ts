import { get, limitToFirst, orderByChild, query, ref, startAt, endAt } from "firebase/database";
import { db } from "@/lib/firebase";
import type { User } from "@/types";
import { createTimedCache } from "@/lib/cache";

type UserRecord = Record<string, unknown> & {
  id?: string;
  username?: string;
  username_lower?: string;
  name?: string;
  name_lower?: string;
  avatar_url?: string | null;
  created_at?: string;
  createdAt?: string;
};

const PROFILE_TTL_MS = 5 * 60 * 1000;
const ALL_USERS_TTL_MS = 2 * 60 * 1000;

function normalizeLabel(value?: string | null): string {
  return value?.trim().replace(/^@/, "") || "";
}

function isPlaceholderLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "unknown" ||
    normalized === "unknown user" ||
    normalized === "anonymous" ||
    normalized === "guest" ||
    normalized === "user"
  );
}

export function formatFallbackUserName(userId: string) {
  const shortId = userId.trim().slice(0, 6);
  return shortId ? `User ${shortId}` : "User";
}

export function normalizeUserRecord(id: string, raw: UserRecord): User {
  const username = normalizeLabel(raw.username);
  const name = normalizeLabel(raw.name);
  const displayName =
    (name && !isPlaceholderLabel(name) && name !== id.trim() ? name : null) ||
    (username && !isPlaceholderLabel(username) && username !== id.trim() ? username : null) ||
    formatFallbackUserName(id);

  return {
    id: raw.id || id,
    username: username || id,
    name: displayName,
    avatar_url: raw.avatar_url || null,
    created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

export function createFallbackUser(userId: string): User {
  return {
    id: userId,
    username: userId,
    name: formatFallbackUserName(userId),
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

const cachedGetUserProfile = createTimedCache<[string], User | null>({
  ttlMs: PROFILE_TTL_MS,
  key: (userId) => userId,
  loader: async (userId) => {
    const snapshot = await get(ref(db, `users/${userId}`));
    if (!snapshot.exists()) return null;

    const raw = snapshot.val() as UserRecord;
    return normalizeUserRecord(userId, raw);
  },
});

const cachedGetAllUsers = createTimedCache<[], Record<string, User>>({
  ttlMs: ALL_USERS_TTL_MS,
  key: () => "all-users",
  loader: async () => {
    try {
      const snapshot = await get(ref(db, "users"));
      if (!snapshot.exists()) return {};

      const raw = snapshot.val() as Record<string, UserRecord>;
      return Object.fromEntries(Object.entries(raw).map(([id, user]) => [id, normalizeUserRecord(id, user)]));
    } catch (error) {
      console.warn("All-users cache failed, returning an empty set:", error);
      return {};
    }
  },
});

const cachedSearchUsers = createTimedCache<[string], Record<string, User>>({
  ttlMs: ALL_USERS_TTL_MS,
  key: (term) => term.trim().toLowerCase(),
  loader: async (term) => {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return {};

    const searchBounds = `${normalized}\uf8ff`;
    const [usernameSnapshot, nameSnapshot] = await Promise.all([
      get(query(ref(db, "users"), orderByChild("username"), startAt(normalized), endAt(searchBounds), limitToFirst(20))),
      get(query(ref(db, "users"), orderByChild("name_lower"), startAt(normalized), endAt(searchBounds), limitToFirst(20))),
    ]);

    const matches = new Map<string, User>();

    for (const snapshot of [usernameSnapshot, nameSnapshot]) {
      if (!snapshot.exists()) continue;

      const value = snapshot.val() as Record<string, UserRecord>;
      for (const [id, user] of Object.entries(value)) {
        matches.set(id, normalizeUserRecord(id, user));
      }
    }

    return Object.fromEntries(matches.entries());
  },
});

export async function getUserProfile(userId: string): Promise<User> {
  return (await cachedGetUserProfile(userId)) || createFallbackUser(userId);
}

export async function getUsersByIds(userIds: string[]): Promise<Record<string, User>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const users = await Promise.all(uniqueIds.map(async (userId) => [userId, await getUserProfile(userId)] as const));
  return Object.fromEntries(users);
}

export async function getAllUsersCached(): Promise<Record<string, User>> {
  return (await cachedGetAllUsers()) || {};
}

export async function searchUsersCached(term: string): Promise<Record<string, User>> {
  return (await cachedSearchUsers(term)) || {};
}
