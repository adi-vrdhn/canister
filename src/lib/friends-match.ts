import { db } from "@/lib/firebase";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";
import { UserTasteWithContent, UserTaste } from "@/types";
import { getUserTasteProfile, getAllUserTastesProfiles } from "./user-taste";
import { getUserMovieLogs } from "./logs";

export interface Friend {
  userId: string;
  username: string;
  name: string;
  avatar_url: string | null;
  tasteCount: number;
  isComplete: boolean;
}

/**
 * Get all users who have a minimum taste profile (7+ movies)
 */
export async function getAvailableFriends(
  currentUserId: string
): Promise<Friend[]> {
  try {
    console.log("getFriends: Fetching all users");
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      console.log("getFriends: No users found");
      return [];
    }

    const allUsers = snapshot.val();
    const friends: Friend[] = [];

    // Get all taste profiles to count movies per user
    const allTastes = await getAllUserTastesProfiles();

    // Convert to user array and filter
    Object.entries(allUsers).forEach(([userId, userData]: [string, any]) => {
      // Skip current user
      if (userId === currentUserId) return;

      const userTastes = allTastes[userId] || [];
      const tasteCount = userTastes.length;
      const isComplete = tasteCount >= 7;

      friends.push({
        userId,
        username: userData.username || "Unknown",
        name: userData.name || userData.username || "User",
        avatar_url: userData.avatar_url || null,
        tasteCount,
        isComplete,
      });
    });

    console.log(
      "getFriends: Found",
      friends.length,
      "users, complete:",
      friends.filter((f) => f.isComplete).length
    );

    return friends.sort((a, b) => b.tasteCount - a.tasteCount);
  } catch (error) {
    console.error("Error fetching friends:", error);
    return [];
  }
}

/**
 * Get a specific user's taste profile
 */
export async function getFriendTasteProfile(
  userId: string
): Promise<UserTasteWithContent[]> {
  try {
    console.log("getFriendTasteProfile: Fetching for user", userId);
    const tastes = await getUserTasteProfile(userId);
    console.log("getFriendTasteProfile: Got", tastes.length, "tastes");
    return tastes;
  } catch (error) {
    console.error("Error fetching friend taste profile:", error);
    return [];
  }
}

/**
 * Get full taste profile including explicit taste picks and all watched logs.
 * Logs carry reaction/review context so the matcher can learn from positive
 * and negative outcomes instead of only seeing masterpieces.
 */
export async function getFullTasteProfile(
  userId: string
): Promise<UserTasteWithContent[]> {
  try {
    console.log("getFullTasteProfile: Fetching for user", userId);

    // 1. Get taste profile
    const tasteProfile = await getUserTasteProfile(userId);
    console.log("getFullTasteProfile: Got", tasteProfile.length, "taste profile items");

    // 2. Get logs and turn them into taste-like entries so reviews/reactions
    // can influence the matcher. We keep the logs but prefer them over the
    // explicit taste entry when a title exists in both.
    const allLogs = await getUserMovieLogs(userId, 500); // Get up to 500 logs
    console.log("getFullTasteProfile: Got", allLogs.length, "logs to merge");

    // 3. Create a set of content_ids from taste profile (to avoid duplication)
    const tasteContentIds = new Set(tasteProfile.map((t) => `${t.content_type}-${t.content_id}`));

    // 4. Convert logs to UserTasteWithContent format.
    const logsAsUserTaste: UserTasteWithContent[] = allLogs.map((log) => ({
      id: `log-${log.id}`,
      user_id: log.user_id,
      content_id: log.content_id,
      content_type: log.content_type,
      added_at: log.watched_date || log.created_at,
      content: log.content,
      source: "log",
      reaction: log.reaction,
      notes: log.notes || null,
      watched_date: log.watched_date,
    }));

    // 5. Merge and deduplicate. Logs are appended last so they win when the
    // same title exists both in explicit taste and in watched history.
    const merged = [...tasteProfile, ...logsAsUserTaste];
    const deduped = Array.from(
      new Map(
        merged.map((item) => [`${item.content_type}-${item.content_id}`, item])
    ).values()
    );

    console.log("getFullTasteProfile: Returning", deduped.length, "total items (taste + logs)");
    return deduped;
  } catch (error) {
    console.error("Error fetching full taste profile:", error);
    return [];
  }
}
