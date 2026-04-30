import { db } from "@/lib/firebase";
import {
  ref,
  set,
  get,
  push,
  remove,
  onValue,
} from "firebase/database";
import { MovieLog, MovieLogWithContent, User, Content, Movie } from "@/types";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";
import { removeWatchedMovieSource, upsertWatchedMovie } from "./watched-movies";
import { getUserProfile } from "./users";

const IMPORTED_RATINGS_CSV_NOTE = "Imported from ratings CSV";

export function isImportedRatingsCsvLog(log: Pick<MovieLog, "notes" | "imported_from_csv">): boolean {
  return Boolean(log.imported_from_csv) || (log.notes || "").trim() === IMPORTED_RATINGS_CSV_NOTE;
}

export function getVisibleLogNotes(log: Pick<MovieLog, "notes" | "imported_from_csv">): string {
  return isImportedRatingsCsvLog(log) ? "" : (log.notes || "");
}

function createFallbackMovieContent(movieId: number): Movie {
  return {
    id: movieId,
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
    } as Content;
  }

  return createFallbackMovieContent(log.content_id) as Content;
}

async function getContentForLog(log: MovieLog): Promise<Content> {
  if (log.content_type === "tv") {
    const show = await getShowDetails(log.content_id);
    if (show) return show as unknown as Content;
    return createFallbackContentForLog(log);
  }

  const movie = await getMovieDetails(log.content_id);
  if (movie) return movie as unknown as Content;
  return createFallbackMovieContent(log.content_id) as Content;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

async function getContentMapForLogs(logs: MovieLog[]): Promise<Map<string, Content>> {
  const uniqueLogs = Array.from(
    new Map(logs.map((log) => [`${log.content_type}-${log.content_id}`, log])).values()
  );
  const contentEntries = await mapWithConcurrency(uniqueLogs, 4, async (log) => {
    const key = `${log.content_type}-${log.content_id}`;
    const content = await getContentForLog(log);
    return [key, content] as const;
  });

  return new Map(contentEntries);
}

/**
 * Create a new movie log
 */
export async function createMovieLog(
  userId: string,
  contentId: number,
  contentType: "movie" | "tv",
  watchedDate: string,
  reaction: 0 | 1 | 2, // 0=Bad, 1=Good, 2=Masterpiece
  notes: string,
  mood?: string,
  contextLog?: {
    location?: string;
    watched_with?: string;
    mood?: string;
  },
  ticketImageUrl?: string | null,
  importedFromCsv?: boolean
): Promise<MovieLog> {
  const logRef = push(ref(db, "movie_logs"));
  const logId = logRef.key;

  if (!logId) throw new Error("Failed to generate log ID");

  // Clean up context_log to remove undefined values
  const cleanedContextLog = contextLog
    ? Object.fromEntries(
        Object.entries(contextLog).filter(([, value]) => value !== undefined)
      )
    : {};

  const newLog: MovieLog = {
    id: logId,
    user_id: userId,
    content_id: contentId,
    content_type: contentType,
    watched_date: watchedDate,
    reaction,
    notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Firebase rejects undefined values, so only persist optional fields when present.
  if (mood !== undefined) {
    newLog.mood = mood;
  }

  // Only add context_log if it has values
  if (Object.keys(cleanedContextLog).length > 0) {
    (newLog as any).context_log = cleanedContextLog;
  }

  if (ticketImageUrl) {
    newLog.ticket_image_url = ticketImageUrl;
  }

  if (importedFromCsv) {
    newLog.imported_from_csv = true;
  }

  await set(logRef, newLog);
  await upsertWatchedMovie(userId, contentId, contentType, "log");
  return newLog;
}

/**
 * Update a movie log
 */
export async function updateMovieLog(
  logId: string,
  updates: Partial<MovieLog>
): Promise<void> {
  const logRef = ref(db, `movie_logs/${logId}`);
  const snapshot = await get(logRef);

  if (!snapshot.exists()) {
    throw new Error("Log not found");
  }

  const currentLog = snapshot.val();
  const mergedLog = {
    ...currentLog,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await set(logRef, mergedLog);

  if (mergedLog.watched_date && !mergedLog.watch_later) {
    await upsertWatchedMovie(
      mergedLog.user_id,
      mergedLog.content_id,
      mergedLog.content_type,
      "log"
    );
  }
}

/**
 * Delete a movie log
 */
export async function deleteMovieLog(logId: string): Promise<void> {
  const logRef = ref(db, `movie_logs/${logId}`);
  const snapshot = await get(logRef);
  if (snapshot.exists()) {
    const log = snapshot.val() as MovieLog;
    if (!log.watch_later) {
      await removeWatchedMovieSource(log.user_id, log.content_id, log.content_type, "log");
    }
  }
  await remove(logRef);
}

/**
 * Get user's movie logs
 */
export async function getUserMovieLogs(userId: string, limit: number = 50): Promise<MovieLogWithContent[]> {
  try {
    const snapshot = await get(ref(db, "movie_logs"));

    if (!snapshot.exists()) return [];

    const allLogs = snapshot.val();
    const userLogs = Object.values(allLogs)
      .sort((a: any, b: any) => new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime())
      .slice(0, limit) as MovieLog[];

    const [contentMap, user] = await Promise.all([
      getContentMapForLogs(userLogs),
      getUserProfile(userId),
    ]);

    const logsWithContent: MovieLogWithContent[] = userLogs.map((log) => ({
      ...log,
      notes: getVisibleLogNotes(log),
      content: contentMap.get(`${log.content_type}-${log.content_id}`) || createFallbackContentForLog(log),
      user,
    }));

    return logsWithContent;
  } catch (error) {
    console.error("Error fetching user movie logs:", error);
    return [];
  }
}

/**
 * Get public movie logs (for discovery/feed)
 */
export async function getPublicMovieLogs(limit: number = 50): Promise<MovieLogWithContent[]> {
  try {
    const snapshot = await get(ref(db, "movie_logs"));

    if (!snapshot.exists()) return [];

    const allLogs = snapshot.val();
    const publicLogs = Object.values(allLogs)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit) as MovieLog[];

    const uniqueUserIds = Array.from(new Set(publicLogs.map((log) => log.user_id)));
    const [contentMap, userEntries] = await Promise.all([
      getContentMapForLogs(publicLogs),
      mapWithConcurrency(uniqueUserIds, 6, async (userId) => [userId, await getUserProfile(userId)] as const),
    ]);
    const usersById = new Map(userEntries);

    const logsWithContent: MovieLogWithContent[] = publicLogs.map((log) => ({
      ...log,
      notes: getVisibleLogNotes(log),
      content: contentMap.get(`${log.content_type}-${log.content_id}`) || createFallbackContentForLog(log),
      user: usersById.get(log.user_id) || {
        id: log.user_id,
        username: "",
        name: "Unknown",
        avatar_url: null,
        created_at: new Date().toISOString(),
      },
    }));

    return logsWithContent;
  } catch (error) {
    console.error("Error fetching public movie logs:", error);
    return [];
  }
}

/**
 * Get logs for a specific movie/show
 */
export async function getLogsForContent(
  contentId: number,
  contentType: "movie" | "tv",
  limit: number = 20
): Promise<MovieLogWithContent[]> {
  try {
    const snapshot = await get(ref(db, "movie_logs"));

    if (!snapshot.exists()) return [];

    const allLogs = snapshot.val();
    const contentLogs = Object.values(allLogs)
      .filter((log: any) => log.content_type === contentType)
      .sort((a: any, b: any) => new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime())
      .slice(0, limit) as MovieLog[];

    // Fetch content and user details
    const content =
      contentType === "tv"
        ? ((await getShowDetails(contentId)) as unknown as Content) || {
            id: contentId,
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
          }
        : ((await getMovieDetails(contentId)) as unknown as Content) || createFallbackMovieContent(contentId);

    const logsWithContent: MovieLogWithContent[] = await Promise.all(
      contentLogs.map(async (log) => {
        const user = await getUserProfile(log.user_id);

        return {
          ...log,
          notes: getVisibleLogNotes(log),
          content,
          user,
        };
      })
    );

    return logsWithContent;
  } catch (error) {
    console.error("Error fetching content logs:", error);
    return [];
  }
}

/**
 * Check if already logged this movie
 */
export async function hasUserLoggedContent(
  userId: string,
  contentId: number,
  contentType: "movie" | "tv"
): Promise<MovieLog | null> {
  try {
    const snapshot = await get(ref(db, "movie_logs"));

    if (!snapshot.exists()) return null;

    const allLogs = snapshot.val();
    const existingLog = Object.values(allLogs).find(
      (log: any) =>
        log.user_id === userId && log.content_id === contentId && log.content_type === contentType
    ) as MovieLog | undefined;

    return existingLog || null;
  } catch (error) {
    console.error("Error checking log:", error);
    return null;
  }
}

/**
 * Get user's stats for a period
 */
export async function getUserLogStats(userId: string, days: number = 30): Promise<{
  totalLogged: number;
  masterpieceCount: number;
  goodCount: number;
  badCount: number;
  mostCommonMood?: string;
  mostWatchedGenre?: string;
}> {
  try {
    const snapshot = await get(ref(db, "movie_logs"));

    if (!snapshot.exists()) {
      return {
        totalLogged: 0,
        masterpieceCount: 0,
        goodCount: 0,
        badCount: 0,
      };
    }

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const userLogs = Object.values(snapshot.val()).filter(
      (log: any) => new Date(log.watched_date) >= dateThreshold
    ) as MovieLog[];

    const totalLogged = userLogs.length;
    let masterpieceCount = 0;
    let goodCount = 0;
    let badCount = 0;
    
    userLogs.forEach((log) => {
      if (log.reaction === 2) masterpieceCount++;
      else if (log.reaction === 1) goodCount++;
      else if (log.reaction === 0) badCount++;
    });

    // Find most common mood
    const moodCounts: Record<string, number> = {};
    userLogs.forEach((log) => {
      if (log.mood) {
        moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
      }
    });
    const mostCommonMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      totalLogged,
      masterpieceCount,
      goodCount,
      badCount,
      mostCommonMood,
    };
  } catch (error) {
    console.error("Error calculating stats:", error);
    return {
      totalLogged: 0,
      masterpieceCount: 0,
      goodCount: 0,
      badCount: 0,
    };
  }
}

/**
 * Quick rate a movie (for swipe feature)
 * Saves immediately with minimal data
 */
export async function quickRateMovie(
  userId: string,
  contentId: number,
  contentType: "movie" | "tv",
  reaction: 0 | 1 | 2 // 0=Bad, 1=Good, 2=Masterpiece
): Promise<MovieLog> {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const newLog = await createMovieLog(
      userId,
      contentId,
      contentType,
      today,
      reaction,
      "" // Empty notes for quick swipe
    );
    console.log("Quick rated movie:", contentId, "reaction:", reaction);
    return newLog;
  } catch (error) {
    console.error("Error quick rating movie:", error);
    throw error;
  }
}

/**
 * Add movie to watchlist
 */
export async function addToWatchlist(
  userId: string,
  contentId: number,
  contentType: "movie" | "tv"
): Promise<MovieLog> {
  try {
    const logRef = push(ref(db, "movie_logs"));
    const logId = logRef.key;

    if (!logId) throw new Error("Failed to generate log ID");

    const newLog: MovieLog = {
      id: logId,
      user_id: userId,
      content_id: contentId,
      content_type: contentType,
      watched_date: "", // Not watched yet
      reaction: 0, // No reaction yet
      notes: "",
      watch_later: true, // Mark as watch later
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await set(logRef, newLog);
    console.log("Added to watchlist:", contentId);
    return newLog;
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    throw error;
  }
}

/**
 * Get user's watchlist
 */
export async function getUserWatchlist(userId: string): Promise<MovieLogWithContent[]> {
  try {
    const logsRef = ref(db, "movie_logs");
    const snapshot = await get(logsRef);

    if (!snapshot.exists()) return [];

    const allLogs = snapshot.val();
    const watchlist = Object.values(allLogs)
      .filter((log: any) => log.user_id === userId && log.watch_later === true)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) as MovieLog[];

    // Fetch content details for each log
    const logsWithContent: MovieLogWithContent[] = await Promise.all(
      watchlist.map(async (log) => {
        let content: Content;
        if (log.content_type === "tv") {
          const show = await getShowDetails(log.content_id);
          content = show as unknown as Content;
        } else {
          const movie = await getMovieDetails(log.content_id);
          content = movie as unknown as Content;
        }

        // Fetch user info
        const userRef = ref(db, `users/${log.user_id}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();
        const user: User = {
          id: userData?.id || log.user_id,
          username: userData?.username || "",
          name: userData?.name || "Unknown",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.created_at || new Date().toISOString(),
        };

        return {
          ...log,
          notes: getVisibleLogNotes(log),
          content,
          user,
        };
      })
    );

    return logsWithContent;
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return [];
  }
}
