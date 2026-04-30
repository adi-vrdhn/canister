import { db } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { Content, MovieLog, MovieLogWithContent, User } from "@/types";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";
import { getVisibleLogNotes } from "./logs";
import { getUserProfile, getUsersByIds } from "./users";

function createFallbackContentForLog(log: MovieLog): Content {
  if (log.content_type === "tv") {
    return {
      id: log.content_id,
      title: "Unknown Show",
      name: "Unknown Show",
      poster_url: null,
      genres: [],
      actors: [],
      language: null,
      status: null,
      release_date: null,
      overview: "Show details are unavailable right now.",
      runtime: null,
      rating: null,
      created_at: new Date().toISOString(),
      type: "tv",
    };
  }

  return {
    id: log.content_id,
    title: "Unknown Movie",
    poster_url: null,
    backdrop_url: null,
    genres: [],
    platforms: [],
    director: null,
    actors: [],
    language: null,
    release_date: null,
    overview: "Movie details are unavailable right now.",
    runtime: null,
    rating: null,
    created_at: new Date().toISOString(),
    type: "movie",
  };
}

/**
 * Get logs from users that current user is following (last 14 days)
 */
export async function getFriendLogs(userId: string, daysBack: number = 14, limit: number = 50): Promise<(MovieLogWithContent & { friend: User })[]> {
  try {
    // 1. Get list of users that current user is following
    const followSnapshot = await get(ref(db, "follows"));

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

    // Watch-only markers should never surface in activity feeds.
    // We still show real logs here, but suppress any item that was only
    // marked watched from a list and not logged as a full movie log.
    const watchedRef = ref(db, "watched_movies");
    const watchedSnapshot = await get(watchedRef);
    const watchOnlyKeys = new Set<string>();

    if (watchedSnapshot.exists()) {
      const allWatched = watchedSnapshot.val() as Record<string, any>;
      Object.values(allWatched).forEach((item) => {
        if (
          item &&
          followingIds.includes(item.user_id) &&
          item.list_marked &&
          !item.logged
        ) {
          watchOnlyKeys.add(`${item.user_id}__${item.content_type}__${item.content_id}`);
        }
      });
    }

    // 2. Get all movie logs
    const logsSnapshot = await get(ref(db, "movie_logs"));

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
        const watchKey = `${log.user_id}__${log.content_type}__${log.content_id}`;
        return followingIds.includes(log.user_id) && logDate >= dateThreshold && !watchOnlyKeys.has(watchKey);
      })
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    // 4. Fetch content and user details for each log
    const friendUsers = await getUsersByIds(friendLogs.map((log: any) => log.user_id));

    const logsWithDetails = await Promise.all(
      friendLogs.map(async (log: any) => {
        try {
          // Fetch content
          let content: Content | null;
          if (log.content_type === "tv") {
            content = (await getShowDetails(log.content_id)) as unknown as Content | null;
          } else {
            content = (await getMovieDetails(log.content_id)) as unknown as Content | null;
          }

          // Fetch friend user info
          const friend = friendUsers[log.user_id] || (await getUserProfile(log.user_id));

          return {
            ...log,
            notes: getVisibleLogNotes(log),
            content: content || createFallbackContentForLog(log),
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
