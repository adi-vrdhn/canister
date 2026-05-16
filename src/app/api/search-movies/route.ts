import { type NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import type { TMDBMovie } from "@/types";

// Private server-only key — never sent to the browser
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Entries older than this are treated as stale and re-fetched from TMDB
const CACHE_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_CACHED_RESULTS = 10;
const RESULT_LIMIT = 20;

const LEADING_ARTICLES = new Set(["a", "an", "the"]);

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchKey(value: string): string {
  const normalized = normalizeQuery(value);
  const tokens = normalized.split(" ").filter(Boolean);
  while (tokens.length > 1 && LEADING_ARTICLES.has(tokens[0])) {
    tokens.shift();
  }
  return tokens.join(" ");
}

function parseMovie(key: string, raw: Record<string, unknown>): TMDBMovie | null {
  const id = Number(raw.id ?? key);
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!Number.isFinite(id) || !title) return null;

  const genreIds: number[] =
    Array.isArray(raw.genres) && raw.genres.every((v) => typeof v === "number")
      ? (raw.genres as number[])
      : Array.isArray(raw.genre_ids) && raw.genre_ids.every((v) => typeof v === "number")
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

async function queryFirebaseCache(queryText: string): Promise<TMDBMovie[]> {
  try {
    const adminDb = getFirebaseAdminDatabase();
    const normalized = normalizeQuery(queryText);
    const searchKey = buildSearchKey(queryText);
    const variants = Array.from(new Set([normalized, searchKey].filter(Boolean)));
    const now = Date.now();

    const snapshots = await Promise.all(
      variants.flatMap((variant) => {
        const rangeEnd = `${variant}`;
        return [
          adminDb.ref("movies").orderByChild("title_lower").startAt(variant).endAt(rangeEnd).limitToFirst(RESULT_LIMIT).get(),
          adminDb.ref("movies").orderByChild("search_title_key").startAt(variant).endAt(rangeEnd).limitToFirst(RESULT_LIMIT).get(),
        ];
      })
    );

    const results = new Map<number, TMDBMovie>();

    for (const snapshot of snapshots) {
      if (!snapshot.exists()) continue;
      const raw = snapshot.val() as Record<string, Record<string, unknown>>;
      for (const [key, value] of Object.entries(raw)) {
        const id = Number(value.id ?? key);
        if (results.has(id)) continue;

        // Skip stale entries so TMDB gets called for a fresh copy
        if (typeof value.updated_at === "string") {
          const updatedAt = new Date(value.updated_at).getTime();
          if (Number.isFinite(updatedAt) && now - updatedAt > CACHE_STALE_AFTER_MS) continue;
        }

        const movie = parseMovie(key, value);
        if (movie) results.set(movie.id, movie);
      }
    }

    return Array.from(results.values()).slice(0, RESULT_LIMIT);
  } catch {
    return [];
  }
}

async function fetchFromTmdb(query: string, page: number): Promise<TMDBMovie[]> {
  if (!TMDB_API_KEY) return [];

  const url = new URL(`${TMDB_BASE_URL}/search/movie`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return [];
    const data = (await response.json()) as { results?: TMDBMovie[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

async function saveToCache(movies: TMDBMovie[]): Promise<void> {
  if (movies.length === 0) return;
  try {
    const adminDb = getFirebaseAdminDatabase();
    const timestamp = new Date().toISOString();
    const updates: Record<string, unknown> = {};

    for (const movie of movies) {
      if (!movie.id || !movie.title) continue;
      const genres = Array.isArray(movie.genres)
        ? movie.genres
        : Array.isArray(movie.genre_ids)
          ? movie.genre_ids
          : [];

      updates[`movies/${movie.id}`] = {
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path ?? null,
        genres,
        genre_ids: genres,
        director: movie.director ?? null,
        release_date: movie.release_date ?? "",
        overview: movie.overview ?? "",
        runtime: movie.runtime ?? 0,
        vote_average: movie.vote_average ?? 0,
        popularity: movie.popularity ?? 0,
        vote_count: movie.vote_count ?? 0,
        title_lower: normalizeQuery(movie.title),
        search_title_key: buildSearchKey(movie.title),
        cached_at: timestamp,
        updated_at: timestamp,
      };
    }

    await adminDb.ref().update(updates);
  } catch {
    // Cache writes are best-effort; don't fail the response
  }
}

function dedupeMovies(movies: TMDBMovie[]): TMDBMovie[] {
  const seen = new Map<number, TMDBMovie>();
  for (const movie of movies) {
    if (!seen.has(movie.id)) seen.set(movie.id, movie);
  }
  return Array.from(seen.values());
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("q") ?? "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1"));
  const trimmed = rawQuery.trim();

  if (!trimmed || trimmed.length < 2) {
    return NextResponse.json([]);
  }

  // 1. Check Firebase cache first
  const cached = await queryFirebaseCache(trimmed);

  if (cached.length >= MIN_CACHED_RESULTS && page === 1) {
    return NextResponse.json(cached);
  }

  // 2. Call TMDB — API key stays server-side
  const fresh = await fetchFromTmdb(trimmed, page);

  // 3. Write results back to cache without blocking the response
  if (fresh.length > 0) {
    void saveToCache(fresh);
  }

  // 4. Return merged, deduped results
  const combined = dedupeMovies([...cached, ...fresh]).slice(0, RESULT_LIMIT);
  return NextResponse.json(combined);
}
