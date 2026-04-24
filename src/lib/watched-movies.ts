import { db } from "@/lib/firebase";
import { get, ref, remove, set } from "firebase/database";
import type { WatchedMovie, MovieLog } from "@/types";

export type { WatchedMovie } from "@/types";

type WatchedSource = "log" | "list";

function watchedMovieKey(userId: string, contentType: "movie" | "tv", contentId: number) {
  return `${userId}__${contentType}__${contentId}`;
}

export async function upsertWatchedMovie(
  userId: string,
  contentId: number,
  contentType: "movie" | "tv",
  source: WatchedSource
): Promise<WatchedMovie> {
  const id = watchedMovieKey(userId, contentType, contentId);
  const watchedRef = ref(db, `watched_movies/${id}`);
  const snapshot = await get(watchedRef);
  const existing = snapshot.exists() ? (snapshot.val() as WatchedMovie) : null;
  const now = new Date().toISOString();

  const next: WatchedMovie = {
    id,
    user_id: userId,
    content_id: contentId,
    content_type: contentType,
    logged: Boolean(existing?.logged) || source === "log",
    list_marked: Boolean(existing?.list_marked) || source === "list",
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  await set(watchedRef, next);
  return next;
}

export async function removeWatchedMovieSource(
  userId: string,
  contentId: number,
  contentType: "movie" | "tv",
  source: WatchedSource
): Promise<void> {
  const id = watchedMovieKey(userId, contentType, contentId);
  const watchedRef = ref(db, `watched_movies/${id}`);
  const snapshot = await get(watchedRef);
  if (!snapshot.exists()) return;

  const current = snapshot.val() as WatchedMovie;
  const next: WatchedMovie = {
    ...current,
    logged: source === "log" ? false : current.logged,
    list_marked: source === "list" ? false : current.list_marked,
    updated_at: new Date().toISOString(),
  };

  if (!next.logged && !next.list_marked) {
    await remove(watchedRef);
    return;
  }

  await set(watchedRef, next);
}

export async function seedWatchedMoviesFromLogs(userId: string): Promise<void> {
  const metaRef = ref(db, `watched_movies_meta/${userId}/seeded_from_logs_at`);
  const metaSnapshot = await get(metaRef);
  if (metaSnapshot.exists()) return;

  const logsRef = ref(db, "movie_logs");
  const logsSnapshot = await get(logsRef);

  if (logsSnapshot.exists()) {
    const allLogs = logsSnapshot.val() as Record<string, MovieLog>;
    const userLogs = Object.values(allLogs).filter(
      (log) => log.user_id === userId && !log.watch_later && Boolean(log.watched_date)
    );

    for (const log of userLogs) {
      await upsertWatchedMovie(
        userId,
        log.content_id,
        log.content_type,
        "log"
      );
    }
  }

  await set(metaRef, new Date().toISOString());
}

export async function getUserWatchedMovies(userId: string): Promise<WatchedMovie[]> {
  await seedWatchedMoviesFromLogs(userId);

  const watchedRef = ref(db, "watched_movies");
  const snapshot = await get(watchedRef);
  if (!snapshot.exists()) return [];

  const allWatched = snapshot.val() as Record<string, WatchedMovie>;
  return Object.values(allWatched)
    .filter((item) => item.user_id === userId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function hasUserWatchedContent(
  userId: string,
  contentId: number,
  contentType: "movie" | "tv"
): Promise<WatchedMovie | null> {
  const id = watchedMovieKey(userId, contentType, contentId);
  const snapshot = await get(ref(db, `watched_movies/${id}`));
  return snapshot.exists() ? (snapshot.val() as WatchedMovie) : null;
}
