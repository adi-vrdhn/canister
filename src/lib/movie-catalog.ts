import { endAt, get, limitToFirst, orderByChild, query, ref, set, startAt } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import type { TMDBMovie } from "@/types";

type MovieCatalogRecord = TMDBMovie & {
  title_lower: string;
  search_title_key: string;
  cached_at: string;
  updated_at: string;
};

const LEADING_ARTICLES = new Set(["a", "an", "the"]);
const MOVIE_CATALOG_LIMIT = 20;
const MOVIE_CATALOG_READS_DISABLED_KEY = "cineparte.movieCatalog.readsDisabled";
const MOVIE_CATALOG_WRITES_DISABLED_KEY = "cineparte.movieCatalog.writesDisabled";

let movieCatalogReadsDisabled = readPersistentFlag(MOVIE_CATALOG_READS_DISABLED_KEY);
let movieCatalogWritesDisabled = readPersistentFlag(MOVIE_CATALOG_WRITES_DISABLED_KEY);
let movieCatalogReadInFlight: Promise<TMDBMovie[]> | null = null;
let movieCatalogWriteInFlight: Promise<void> | null = null;
let readWarningLogged = false;
let writeWarningLogged = false;

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMovieSearchKey(value: string): string {
  const normalized = normalizeSearchText(value);
  const tokens = normalized.split(" ").filter(Boolean);

  while (tokens.length > 1 && LEADING_ARTICLES.has(tokens[0])) {
    tokens.shift();
  }

  return tokens.join(" ");
}

function toMovieCatalogRecord(movie: TMDBMovie, timestamp: string): MovieCatalogRecord {
  const titleLower = normalizeSearchText(movie.title || "");
  const searchTitleKey = buildMovieSearchKey(movie.title || "");
  const genres = Array.isArray(movie.genres) ? movie.genres : Array.isArray(movie.genre_ids) ? movie.genre_ids : [];

  return {
    id: movie.id,
    title: movie.title || "",
    poster_path: movie.poster_path || null,
    genres,
    genre_ids: Array.isArray(movie.genre_ids) ? movie.genre_ids : genres,
    director: movie.director ?? null,
    release_date: movie.release_date || "",
    overview: movie.overview || "",
    runtime: Number.isFinite(movie.runtime) ? movie.runtime : 0,
    vote_average: Number.isFinite(movie.vote_average) ? movie.vote_average : 0,
    popularity: Number.isFinite(movie.popularity || 0) ? Number(movie.popularity || 0) : 0,
    vote_count: Number.isFinite(movie.vote_count || 0) ? Number(movie.vote_count || 0) : 0,
    title_lower: titleLower,
    search_title_key: searchTitleKey,
    cached_at: timestamp,
    updated_at: timestamp,
  };
}

function normalizeCatalogMovie(key: string, raw: Record<string, unknown>): TMDBMovie | null {
  const id = Number(raw.id ?? key);
  const title = typeof raw.title === "string" ? raw.title : "";

  if (!Number.isFinite(id) || !title.trim()) {
    return null;
  }

  const genreIds =
    Array.isArray(raw.genres) && raw.genres.every((value) => typeof value === "number")
      ? (raw.genres as number[])
      : Array.isArray(raw.genre_ids) && raw.genre_ids.every((value) => typeof value === "number")
        ? (raw.genre_ids as number[])
        : [];

  return {
    id,
    title,
    poster_path: typeof raw.poster_path === "string" ? raw.poster_path : null,
    genres: genreIds,
    genre_ids: genreIds,
    director: typeof raw.director === "string" ? raw.director : null,
    release_date: typeof raw.release_date === "string" ? raw.release_date : "",
    overview: typeof raw.overview === "string" ? raw.overview : "",
    runtime: typeof raw.runtime === "number" ? raw.runtime : 0,
    vote_average: typeof raw.vote_average === "number" ? raw.vote_average : 0,
    popularity: typeof raw.popularity === "number" ? raw.popularity : 0,
    vote_count: typeof raw.vote_count === "number" ? raw.vote_count : 0,
  };
}

function buildCatalogSearchVariants(queryText: string): string[] {
  const normalized = normalizeSearchText(queryText);
  const stripped = buildMovieSearchKey(queryText);
  return Array.from(new Set([normalized, stripped].filter((entry) => entry.length > 0)));
}

function hasAuthenticatedUser() {
  return typeof window !== "undefined" && Boolean(auth.currentUser);
}

export async function searchMovieCatalog(queryText: string, limit: number = MOVIE_CATALOG_LIMIT): Promise<TMDBMovie[]> {
  if (movieCatalogReadsDisabled || !hasAuthenticatedUser()) {
    return [];
  }

  if (movieCatalogReadInFlight) {
    return movieCatalogReadInFlight;
  }

  const readPromise = (async () => {
    try {
      const variants = buildCatalogSearchVariants(queryText);
      if (variants.length === 0) {
        return [];
      }

      const searchSnapshots = await Promise.all(
        variants.flatMap((variant) => {
          const searchBounds = `${variant}\uf8ff`;
          return [
            get(
              query(ref(db, "movies"), orderByChild("title_lower"), startAt(variant), endAt(searchBounds), limitToFirst(limit))
            ),
            get(
              query(
                ref(db, "movies"),
                orderByChild("search_title_key"),
                startAt(variant),
                endAt(searchBounds),
                limitToFirst(limit)
              )
            ),
          ];
        })
      );

      const results = new Map<number, TMDBMovie>();

      for (const snapshot of searchSnapshots) {
        if (!snapshot.exists()) {
          continue;
        }

        const raw = snapshot.val() as Record<string, Record<string, unknown>>;
        for (const [movieKey, movieValue] of Object.entries(raw)) {
          const normalized = normalizeCatalogMovie(movieKey, movieValue);
          if (normalized && !results.has(normalized.id)) {
            results.set(normalized.id, normalized);
          }
        }
      }

      return Array.from(results.values()).slice(0, limit);
    } catch (error) {
      movieCatalogReadsDisabled = true;
      persistFlag(MOVIE_CATALOG_READS_DISABLED_KEY);
      movieCatalogWritesDisabled = true;
      persistFlag(MOVIE_CATALOG_WRITES_DISABLED_KEY);
      if (!readWarningLogged) {
        readWarningLogged = true;
        console.warn("Movie catalog search is unavailable until Firebase rules allow the movies table.");
      }

      if (!isPermissionDenied(error)) {
        console.warn("Movie catalog search failed, falling back to TMDB:", error);
      }
      return [];
    }
  })();

  movieCatalogReadInFlight = readPromise;
  try {
    return await readPromise;
  } finally {
    movieCatalogReadInFlight = null;
  }
}

export async function upsertMovieCatalog(movies: TMDBMovie[]): Promise<void> {
  if (movieCatalogWritesDisabled || !hasAuthenticatedUser()) {
    return;
  }

  if (movieCatalogWriteInFlight) {
    await movieCatalogWriteInFlight;
    return;
  }

  const uniqueMovies = Array.from(new Map(movies.map((movie) => [movie.id, movie])).values());
  if (uniqueMovies.length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();
  const writePromise = (async () => {
    try {
      const results = await Promise.allSettled(
        uniqueMovies.map((movie) => set(ref(db, `movies/${movie.id}`), toMovieCatalogRecord(movie, timestamp)))
      );

      const permissionDenied = results.some((result) => {
        if (result.status !== "rejected") return false;
        return isPermissionDenied(result.reason);
      });

      if (permissionDenied) {
        movieCatalogWritesDisabled = true;
        persistFlag(MOVIE_CATALOG_WRITES_DISABLED_KEY);
        if (!writeWarningLogged) {
          writeWarningLogged = true;
          console.warn("Movie catalog writes are unavailable until Firebase rules allow the movies table.");
        }
      }
    } catch (error) {
      movieCatalogWritesDisabled = true;
      persistFlag(MOVIE_CATALOG_WRITES_DISABLED_KEY);
      if (!writeWarningLogged) {
        writeWarningLogged = true;
        console.warn("Movie catalog writes are unavailable until Firebase rules allow the movies table.");
      }

      if (!isPermissionDenied(error)) {
        console.warn("Movie catalog upsert failed:", error);
      }
    }
  })();

  movieCatalogWriteInFlight = writePromise;
  try {
    await writePromise;
  } finally {
    movieCatalogWriteInFlight = null;
  }
}

function isPermissionDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /permission/i.test(message) && /denied/i.test(message);
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readPersistentFlag(key: string): boolean {
  if (!isBrowser()) return false;
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function persistFlag(key: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Ignore storage failures; the in-memory guard still suppresses retries in this session.
  }
}
