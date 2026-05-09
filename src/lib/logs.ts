import { db } from "@/lib/firebase";
import {
  ref,
  set,
  get,
  push,
  remove,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import { MovieLog, MovieLogWithContent, User, Content, Movie } from "@/types";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";
import { removeWatchedMovieSource, upsertWatchedMovie } from "./watched-movies";
import { createFallbackUser, getUserProfile } from "./users";
import { lsGet, lsSet } from "./local-cache";
import { createLogCreatedNotifications } from "./notifications";

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

async function getLogsForUser(userId: string): Promise<MovieLog[]> {
  const logsQuery = query(ref(db, "movie_logs"), orderByChild("user_id"), equalTo(userId));
  const snapshot = await get(logsQuery);
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as MovieLog[];
}

/**
 * Create a new movie log
 */
export async function createMovieLog(
  userId: string,
  contentId: number,
  contentType: "movie" | "tv",
  watchedDate: string,
  reaction: MovieLog["reaction"] = null,
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
    reaction: reaction ?? null,
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
  try {
    await upsertWatchedMovie(userId, contentId, contentType, "log");
  } catch (error) {
    console.warn("Failed to update watched movie state after logging:", error);
  }

  if (!importedFromCsv) {
    try {
      await createLogCreatedNotifications(newLog);
    } catch (error) {
      console.warn("Failed to create log created notifications:", error);
    }
  }
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
export async function getUserMovieLogs(
  userId: string,
  limit: number = 50,
  currentUser?: User | null
): Promise<MovieLogWithContent[]> {
  const cacheKey = `logs_${userId}_${limit}`;
  const TTL = 5 * 60 * 1000; // 5 minutes

  const cached = lsGet<MovieLogWithContent[]>(cacheKey, TTL);
  if (cached && cached.length > 0) {
    // Return cache immediately and refresh in background
    getUserMovieLogsFromNetwork(userId, limit, currentUser).then((fresh) => {
      if (fresh.length > 0) lsSet(cacheKey, fresh, TTL);
    }).catch(() => {});
    return cached;
  }

  const fresh = await getUserMovieLogsFromNetwork(userId, limit, currentUser);
  if (fresh.length > 0) lsSet(cacheKey, fresh, TTL);
  return fresh;
}

async function getUserMovieLogsFromNetwork(
  userId: string,
  limit: number,
  currentUser?: User | null
): Promise<MovieLogWithContent[]> {
  try {
    const userLogs = await getLogsForUser(userId);
    const recentLogs = userLogs
      .sort((a, b) => new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime())
      .slice(0, limit);

    const [contentMap, user] = await Promise.all([
      getContentMapForLogs(recentLogs),
      currentUser ? Promise.resolve(currentUser) : getUserProfile(userId),
    ]);

    return recentLogs.map((log) => ({
      ...log,
      notes: getVisibleLogNotes(log),
      content: contentMap.get(`${log.content_type}-${log.content_id}`) || createFallbackContentForLog(log),
      user,
    }));
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
      user: usersById.get(log.user_id) || createFallbackUser(log.user_id),
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
      .filter(
        (log: any) =>
          log.content_type === contentType &&
          Number(log.content_id) === contentId &&
          !log.watch_later &&
          Boolean(log.watched_date)
      )
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

    const uniqueUserIds = [...new Set(contentLogs.map((log) => log.user_id))];
    const userEntries = await mapWithConcurrency(uniqueUserIds, 6, async (uid) =>
      [uid, await getUserProfile(uid)] as const
    );
    const usersById = new Map(userEntries);

    const logsWithContent: MovieLogWithContent[] = contentLogs.map((log) => ({
      ...log,
      notes: getVisibleLogNotes(log),
      content,
      user: usersById.get(log.user_id) || createFallbackUser(log.user_id),
    }));

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
    const userLogs = await getLogsForUser(userId);
    const existingLog = userLogs.find((log) => log.content_id === contentId && log.content_type === contentType);

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
  averageCount: number;
  goodCount: number;
  badCount: number;
  mostCommonMood?: string;
  mostWatchedGenre?: string;
}> {
  try {
    const userLogs = await getLogsForUser(userId);

    if (!userLogs.length) {
      return {
        totalLogged: 0,
        masterpieceCount: 0,
        averageCount: 0,
        goodCount: 0,
        badCount: 0,
      };
    }

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const recentLogs = userLogs.filter((log) => new Date(log.watched_date) >= dateThreshold);

  const totalLogged = recentLogs.length;
  let masterpieceCount = 0;
  let goodCount = 0;
  let averageCount = 0;
  let badCount = 0;
    
    recentLogs.forEach((log) => {
      if (log.reaction === 2) masterpieceCount++;
      else if (log.reaction === 1.5) averageCount++;
      else if (log.reaction === 1) goodCount++;
      else if (log.reaction === 0) badCount++;
    });

    // Find most common mood
    const moodCounts: Record<string, number> = {};
    recentLogs.forEach((log) => {
      if (log.mood) {
        moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
      }
    });
    const mostCommonMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      totalLogged,
      masterpieceCount,
      goodCount,
      averageCount,
      badCount,
      mostCommonMood,
    };
  } catch (error) {
    console.error("Error calculating stats:", error);
    return {
      totalLogged: 0,
      masterpieceCount: 0,
      goodCount: 0,
      averageCount: 0,
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
  reaction: 0 | 1 | 1.5 | 2 // 0=Bad, 1=Good, 1.5=Average, 2=Masterpiece
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
    const watchlist = (await getLogsForUser(userId))
      .filter((log) => log.watch_later === true)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const [contentMap, user] = await Promise.all([
      getContentMapForLogs(watchlist),
      getUserProfile(userId),
    ]);

    return watchlist.map((log) => ({
      ...log,
      notes: getVisibleLogNotes(log),
      content: contentMap.get(`${log.content_type}-${log.content_id}`) || createFallbackContentForLog(log),
      user,
    }));
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return [];
  }
}
