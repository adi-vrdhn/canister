import { db } from "@/lib/firebase";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";
import { UserTasteWithContent, UserTaste } from "@/types";
import { getUserTasteProfile, getAllUserTastesProfiles } from "./user-taste";

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
