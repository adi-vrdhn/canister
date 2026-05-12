import { get, ref, update } from "firebase/database";
import { db } from "@/lib/firebase";

const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

export function normalizeUsernameKey(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase();
}

export function getUsernameValidationError(username: string): string | null {
  if (typeof username !== "string") {
    return "Username is required.";
  }

  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    return "Username is required.";
  }

  if (normalized.startsWith("@")) {
    return "Remove the @ symbol. Use letters, numbers, dots, and underscores only.";
  }

  if (normalized.length < 3 || normalized.length > 20) {
    return "Username must be 3-20 characters.";
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return "Use only letters, numbers, dots, and underscores.";
  }

  return null;
}

export function getUsernameIndexRef(username: string) {
  return ref(db, `usernames/${normalizeUsernameKey(username)}`);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const normalizedUsername = normalizeUsernameKey(username);
  if (!normalizedUsername) return true;

  const snapshot = await get(getUsernameIndexRef(normalizedUsername));
  return !snapshot.exists();
}

export async function syncUsernameIndex(userId: string, username: string, previousUsername?: string | null) {
  const nextUsername = normalizeUsernameKey(username);
  if (!nextUsername) return;

  const updates: Record<string, string | null> = {
    [`usernames/${nextUsername}`]: userId,
  };

  const previousKey = previousUsername ? normalizeUsernameKey(previousUsername) : "";
  if (previousKey && previousKey !== nextUsername) {
    updates[`usernames/${previousKey}`] = null;
  }

  await update(ref(db), updates);
}
