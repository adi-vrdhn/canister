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
 * Get full taste profile including taste list + masterpiece logs only.
 * This keeps the taste profile aligned with explicit taste picks and
 * optionally adds the user's masterpiece logs without mixing in other logs.
 */
export async function getFullTasteProfile(
  userId: string
): Promise<UserTasteWithContent[]> {
  try {
    console.log("getFullTasteProfile: Fetching for user", userId);

    // 1. Get taste profile
    const tasteProfile = await getUserTasteProfile(userId);
    console.log("getFullTasteProfile: Got", tasteProfile.length, "taste profile items");

    // 2. Get logs but keep only masterpiece reactions.
    const allLogs = await getUserMovieLogs(userId, 500); // Get up to 500 logs
    const masterpieceLogs = allLogs.filter((log) => log.reaction === 2);
    console.log(
      "getFullTasteProfile: Got",
      masterpieceLogs.length,
      "masterpiece logs (excluded",
      allLogs.length - masterpieceLogs.length,
      "non-masterpieces)"
    );

    // 3. Create a set of content_ids from taste profile (to avoid duplication)
    const tasteContentIds = new Set(tasteProfile.map((t) => `${t.content_type}-${t.content_id}`));

    // 4. Convert masterpiece logs to UserTasteWithContent format
    // Only include logs that aren't already in taste profile
    const logsAsUserTaste: UserTasteWithContent[] = masterpieceLogs
      .filter((log) => !tasteContentIds.has(`${log.content_type}-${log.content_id}`))
      .map((log) => ({
        id: log.id,
        user_id: log.user_id,
        content_id: log.content_id,
        content_type: log.content_type,
        added_at: log.watched_date, // Use watched_date as added_at for consistency
        content: log.content,
      }));

    // 5. Merge and deduplicate
    const merged = [...tasteProfile, ...logsAsUserTaste];
    const deduped = Array.from(
      new Map(
        merged.map((item) => [`${item.content_type}-${item.content_id}`, item])
    ).values()
    );

    console.log("getFullTasteProfile: Returning", deduped.length, "total items (taste + masterpieces)");
    return deduped;
  } catch (error) {
    console.error("Error fetching full taste profile:", error);
    return [];
  }
}
