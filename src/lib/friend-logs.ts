import { db } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { MovieLogWithContent, User, Follow } from "@/types";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";

/**
 * Get logs from users that current user is following (last 14 days)
 */
export async function getFriendLogs(userId: string, daysBack: number = 14, limit: number = 50): Promise<(MovieLogWithContent & { friend: User })[]> {
  try {
    // 1. Get list of users that current user is following
    const followsRef = ref(db, "follows");
    const followSnapshot = await get(followsRef);

    if (!followSnapshot.exists()) {
      return [];
    }

    const allFollows = followSnapshot.val();
    const followingIds = Object.values(allFollows)
      .filter((follow: any) => follow.follower_id === userId && follow.status === "accepted")
      .map((follow: any) => follow.following_id);

    if (followingIds.length === 0) {
      return [];
    }

    // 2. Get all movie logs
    const logsRef = ref(db, "movie_logs");
    const logsSnapshot = await get(logsRef);

    if (!logsSnapshot.exists()) {
      return [];
    }

    // 3. Filter logs from following users created in last X days
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysBack);

    const allLogs = logsSnapshot.val();
    const friendLogs = Object.values(allLogs)
      .filter((log: any) => {
        const logDate = new Date(log.created_at);
        return followingIds.includes(log.user_id) && logDate >= dateThreshold;
      })
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    // 4. Fetch content and user details for each log
    const logsWithDetails = await Promise.all(
      friendLogs.map(async (log: any) => {
        try {
          // Fetch content
          let content;
          if (log.content_type === "tv") {
            content = await getShowDetails(log.content_id);
          } else {
            content = await getMovieDetails(log.content_id);
          }

          // Fetch friend user info
          const userRef = ref(db, `users/${log.user_id}`);
          const userSnapshot = await get(userRef);
          const userData = userSnapshot.val();
          const friend: User = {
            id: userData?.id || log.user_id,
            username: userData?.username || "Unknown",
            name: userData?.name || "Unknown",
            avatar_url: userData?.avatar_url || null,
            created_at: userData?.created_at || new Date().toISOString(),
          };

          return {
            ...log,
            content,
            friend,
          };
        } catch (error) {
          console.error(`Error fetching details for log ${log.id}:`, error);
          return null;
        }
      })
    );

    // Filter out failed requests
    return logsWithDetails.filter((log) => log !== null) as (MovieLogWithContent & { friend: User })[];
  } catch (error) {
    console.error("Error fetching friend logs:", error);
    return [];
  }
}
