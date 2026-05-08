import { UserTasteWithContent } from "@/types";
import { getUserTasteProfile, getAllUserTastesProfiles } from "./user-taste";
import { normalizeUserRecord, getUsersByIds } from "./users";

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
    // Get all taste profiles to count movies per user
    const allTastes = await getAllUserTastesProfiles();
    const userIds = Object.keys(allTastes).filter((userId) => userId !== currentUserId);
    const usersData = await getUsersByIds(userIds);
    const friends: Friend[] = [];

    Object.entries(allTastes).forEach(([userId, userTastes]) => {
      // Skip current user
      if (userId === currentUserId) return;

      const tasteCount = userTastes.length;
      const isComplete = tasteCount >= 7;
      const userData = usersData[userId];

      if (!userData) return;

      const normalized = normalizeUserRecord(userId, userData);

      friends.push({
        userId,
        username: normalized.username,
        name: normalized.name,
        avatar_url: normalized.avatar_url,
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
 * Get the matcher taste profile.
 * We keep this focused on the explicit taste picks so compatibility reflects
 * what the user actually chose to represent their taste.
 */
export async function getFullTasteProfile(
  userId: string
): Promise<UserTasteWithContent[]> {
  try {
    console.log("getFullTasteProfile: Fetching for user", userId);

    const tasteProfile = await getUserTasteProfile(userId);
    console.log("getFullTasteProfile: Returning", tasteProfile.length, "taste profile items");
    return tasteProfile;
  } catch (error) {
    console.error("Error fetching full taste profile:", error);
    return [];
  }
}
