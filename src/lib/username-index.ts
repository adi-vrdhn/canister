import { get, ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
export { getUsernameValidationError, normalizeUsernameKey } from "@/lib/username-utils";

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
