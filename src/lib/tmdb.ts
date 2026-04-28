import { TMDBMovie, TMDBSearchResponse } from "@/types";
import { ParsedIntent } from "./nlp-parser";
import { fetchTmdb } from "./tmdb-transport";

// Genre ID mappings for TMDB discover API
const GENRE_MAP: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

function getMovieGenreIds(movie: TMDBMovie): number[] {
  if (Array.isArray(movie.genres) && movie.genres.length > 0) {
    return movie.genres;
  }

  const genreIds = (movie as TMDBMovie & { genre_ids?: number[] }).genre_ids;
  return Array.isArray(genreIds) ? genreIds : [];
}

export function getGenreIdsForNames(genres: string[]): number[] {
  return Array.from(
    new Set(
      genres
        .map((genre) => GENRE_MAP[genre.toLowerCase()])
        .filter((genreId): genreId is number => typeof genreId === "number")
    )
  );
}

function rankDiscoverResults(movies: TMDBMovie[], preferredGenreIds: number[]): TMDBMovie[] {
  if (movies.length === 0) {
    return [];
  }

  const preferredSet = new Set(preferredGenreIds);

  return movies.slice().sort((a, b) => {
    const score = (movie: TMDBMovie) => {
      const movieGenres = getMovieGenreIds(movie);
      const genreHits = preferredSet.size > 0 ? movieGenres.filter((genreId) => preferredSet.has(genreId)).length : 0;
      let value = genreHits * 500;

      value += Math.min(movie.popularity || 0, 200) * 2.25;
      value += Math.min(movie.vote_count || 0, 5000) * 0.02;
      value += (movie.vote_average || 0) * 14;

      if (preferredSet.size > 0 && genreHits > 0) {
        value += 60;
      }

      return value;
    };

    return score(b) - score(a);
  });
}

interface TMDBDetailedMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Array<{ id: number; name: string }>;
  director?: string;
  release_date: string;
  overview: string;
  runtime: number;
  vote_average: number;
  vote_count: number;
  popularity: number;
  credit?: {
    crew: Array<{ job: string; name: string }>;
  };
}

interface TMDBPersonSearchResult {
  id: number;
  name: string;
  profile_path: string | null;
  popularity?: number;
  known_for_department?: string;
  known_for?: Array<TMDBMovie & { media_type?: string }>;
}

interface TMDBPersonSearchResponse {
  results: TMDBPersonSearchResult[];
}

interface TMDBPersonMovieCredit {
  id: number;
  title?: string;
  release_date?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}

interface TMDBPersonMovieCreditsResponse {
  cast?: TMDBPersonMovieCredit[];
  crew?: Array<TMDBPersonMovieCredit & { job?: string }>;
}

type MovieDetailsResult = ReturnType<typeof normalizeMovieDetails> | null;

const movieDetailsCache = new Map<number, MovieDetailsResult>();
const movieDetailsInFlight = new Map<number, Promise<MovieDetailsResult>>();
const movieDetailsBlockedUntil = new Map<number, number>();

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "by",
  "film",
  "in",
  "movie",
  "of",
  "show",
  "the",
  "tv",
  "with",
]);

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSearchYear(query: string): number | null {
  const match = query.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function removeYear(query: string): string {
  return query.replace(/\b(19\d{2}|20\d{2})\b/g, " ").replace(/\s+/g, " ").trim();
}

function getReleaseYear(movie: Pick<TMDBMovie, "release_date">): number | null {
  if (!movie.release_date) return null;
  const year = Number(movie.release_date.split("-")[0]);
  return Number.isFinite(year) ? year : null;
}

function uniqueMovies(movies: TMDBMovie[]): TMDBMovie[] {
  const seen = new Map<number, TMDBMovie>();
  movies.forEach((movie) => {
    if (!seen.has(movie.id)) {
      seen.set(movie.id, movie);
    }
  });
  return Array.from(seen.values());
}

async function fetchMovieSearch(query: string, page: number): Promise<TMDBMovie[]> {
  if (!query.trim()) return [];
  const response = await fetchTmdb("search/movie", {
    query,
    page,
  });

  if (!response.ok) {
    throw new Error("Failed to search movies");
  }

  const data: TMDBSearchResponse = await response.json();
  return data.results;
}

async function fetchMovieSearchForYear(query: string, year: number): Promise<TMDBMovie[]> {
  if (!query.trim()) return [];
  const response = await fetchTmdb("search/movie", {
    query,
    page: 1,
    year,
    primary_release_year: year,
  });

  if (!response.ok) {
    throw new Error("Failed to search movies by year");
  }

  const data: TMDBSearchResponse = await response.json();
  return data.results;
}

function getPossiblePersonChunks(query: string): string[] {
  const normalized = normalizeSearchText(removeYear(query));
  const tokens = normalized.split(" ").filter((token) => token && !STOP_WORDS.has(token));
  const chunks: string[] = [];

  for (let size = Math.min(4, tokens.length); size >= 2; size -= 1) {
    for (let start = 0; start <= tokens.length - size; start += 1) {
      chunks.push(tokens.slice(start, start + size).join(" "));
    }
  }

  return Array.from(new Set(chunks)).slice(0, 8);
}

async function findPeopleInQuery(query: string): Promise<Array<{ id: number; name: string; chunk: string }>> {
  const chunks = getPossiblePersonChunks(query);
  const people: Array<{ id: number; name: string; chunk: string }> = [];
  const seen = new Set<number>();

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const response = await fetchTmdb("search/person", {
          query: chunk,
          page: 1,
        });
        if (!response.ok) return;

        const data: TMDBPersonSearchResponse = await response.json();
        const chunkNorm = normalizeSearchText(chunk);
        const match = data.results
          .filter((person) => person.known_for_department !== "Sound")
          .find((person) => {
            const nameNorm = normalizeSearchText(person.name);
            return nameNorm === chunkNorm || nameNorm.includes(chunkNorm) || chunkNorm.includes(nameNorm);
          });

        if (match && !seen.has(match.id)) {
          seen.add(match.id);
          people.push({ id: match.id, name: match.name, chunk });
        }
      } catch (error) {
        console.error("TMDB person search error:", error);
      }
    })
  );

  return people.slice(0, 3);
}

function removePersonChunksFromQuery(query: string, people: Array<{ chunk: string }>): string {
  let cleaned = normalizeSearchText(removeYear(query));
  people.forEach((person) => {
    const chunk = normalizeSearchText(person.chunk);
    cleaned = ` ${cleaned} `.replace(` ${chunk} `, " ");
  });

  return cleaned
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(" ");
}

async function getPersonMovieIds(people: Array<{ id: number }>): Promise<Set<number>> {
  const ids = new Set<number>();

  await Promise.all(
    people.map(async (person) => {
      try {
        const response = await fetchTmdb(`person/${person.id}/movie_credits`);
        if (!response.ok) return;

        const data: TMDBPersonMovieCreditsResponse = await response.json();
        [...(data.cast || []), ...(data.crew || [])].forEach((credit) => {
          if (credit.id) ids.add(credit.id);
        });
      } catch (error) {
        console.error("TMDB person credits error:", error);
      }
    })
  );

  return ids;
}

function rankMovieSearchResults(
  movies: TMDBMovie[],
  query: string,
  titleQuery: string,
  options: {
    requestedYear: number | null;
    personMovieIds: Set<number>;
  }
): TMDBMovie[] {
  const normalizedTitleQuery = normalizeSearchText(titleQuery || removeYear(query));
  const queryTokens = normalizedTitleQuery.split(" ").filter(Boolean);

  return movies.slice().sort((a, b) => {
    const score = (movie: TMDBMovie) => {
      const movieTitle = normalizeSearchText(movie.title);
      const movieYear = getReleaseYear(movie);
      let value = 0;

      if (movieTitle === normalizedTitleQuery) value += 120;
      if (normalizedTitleQuery && movieTitle.includes(normalizedTitleQuery)) value += 70;
      value += queryTokens.filter((token) => movieTitle.includes(token)).length * 18;

      if (options.requestedYear && movieYear === options.requestedYear) value += 240;
      if (options.requestedYear && movieYear && Math.abs(movieYear - options.requestedYear) === 1) value += 25;
      if (options.personMovieIds.has(movie.id)) value += 140;

      value += Math.min(movie.popularity || 0, 80) * 0.35;
      value += Math.min(movie.vote_count || 0, 1000) * 0.01;
      value += (movie.vote_average || 0) * 1.5;

      return value;
    };

    return score(b) - score(a);
  });
}

function normalizeMovieDetails(data: TMDBDetailedMovie) {
  let director: string | null = null;
  let actors: string[] | null = null;

  if ((data as any).credits && (data as any).credits.crew) {
    const directorObj = (data as any).credits.crew.find(
      (person: any) => person.job === "Director"
    );
    director = directorObj?.name || null;
  }

  if ((data as any).credits && (data as any).credits.cast) {
    actors = (data as any).credits.cast
      .slice(0, 5)
      .map((person: any) => person.name);
  }

  return {
    id: data.id,
    title: data.title,
    poster_url: data.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
      : null,
    backdrop_url: data.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`
      : null,
    genres: data.genres.map((g) => g.name),
    director,
    actors,
    language: (data as any).original_language || null,
    release_date: data.release_date,
    overview: data.overview,
    runtime: data.runtime,
    rating: data.vote_average,
    platforms: [],
  };
}

export async function searchMovies(query: string, page: number = 1) {
  try {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    if (page > 1) {
      return fetchMovieSearch(trimmedQuery, page);
    }

    const requestedYear = extractSearchYear(trimmedQuery);
    const meaningfulTokenCount = normalizeSearchText(removeYear(trimmedQuery))
      .split(" ")
      .filter((token) => token && !STOP_WORDS.has(token)).length;
    const people = meaningfulTokenCount >= 3 ? await findPeopleInQuery(trimmedQuery) : [];
    const titleQuery = removePersonChunksFromQuery(trimmedQuery, people) || removeYear(trimmedQuery);
    const searchPages = trimmedQuery.length <= 2 ? [1, 2, 3, 4, 5] : [1];
    const baseSearchQueries = Array.from(
      new Set([trimmedQuery, removeYear(trimmedQuery), titleQuery].filter((entry) => entry.trim().length >= 1))
    );
    const yearSearchQueries = requestedYear
      ? Array.from(new Set([titleQuery, removeYear(trimmedQuery)].filter((entry) => entry.trim().length >= 1)))
      : [];

    const [movieResultGroups, personMovieIds] = await Promise.all([
      Promise.all([
        ...baseSearchQueries.flatMap((searchQuery) =>
          searchPages.map((searchPage) => fetchMovieSearch(searchQuery, searchPage).catch(() => []))
        ),
        ...yearSearchQueries.map((searchQuery) =>
          requestedYear ? fetchMovieSearchForYear(searchQuery, requestedYear).catch(() => []) : Promise.resolve([])
        ),
      ]),
      getPersonMovieIds(people),
    ]);

    const movies = uniqueMovies(movieResultGroups.flat());

    if (movies.length === 0) {
      return [];
    }

    return rankMovieSearchResults(movies, trimmedQuery, titleQuery, {
      requestedYear,
      personMovieIds,
    });
  } catch (error) {
    console.error("TMDB search error:", error);
    return [];
  }
}

export async function searchPeople(query: string): Promise<TMDBPersonSearchResult[]> {
  try {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const response = await fetchTmdb("search/person", {
      query: trimmedQuery,
      page: 1,
    });

    if (!response.ok) {
      throw new Error("Failed to search people");
    }

    const data: TMDBPersonSearchResponse = await response.json();
    return data.results
      .slice()
      .sort((a, b) => {
        const aHasImage = a.profile_path ? 1 : 0;
        const bHasImage = b.profile_path ? 1 : 0;
        if (aHasImage !== bHasImage) return bHasImage - aHasImage;
        return (b.popularity || 0) - (a.popularity || 0);
      });
  } catch (error) {
    console.error("TMDB people search error:", error);
    return [];
  }
}

export async function getPopularMovies(page: number = 1, limit: number = 12): Promise<TMDBMovie[]> {
  try {
    const response = await fetchTmdb("movie/popular", { page });

    if (!response.ok) {
      throw new Error("Failed to fetch popular movies");
    }

    const data: TMDBSearchResponse = await response.json();
    return data.results.slice(0, limit);
  } catch (error) {
    console.error("TMDB popular movies error:", error);
    return [];
  }
}

/**
 * Enhanced search using TMDB discover endpoint with genre filtering
 * More powerful than basic search - allows filtering by genre, rating, year, etc.
 */
export async function discoverMoviesByGenre(
  genres: string[],
  options?: {
    minRating?: number;
    minYear?: number;
    maxYear?: number;
    sortBy?: "popularity.desc" | "vote_average.desc" | "release_date.desc";
    page?: number;
  }
) {
  try {
    const results: Map<number, TMDBMovie> = new Map();
    const preferredGenreIds = getGenreIdsForNames(genres);

    // Search for each genre separately to use OR logic instead of AND
    for (const genre of genres) {
      const genreId = GENRE_MAP[genre.toLowerCase()];
      if (!genreId) continue;

      try {
        const response = await fetchTmdb("discover/movie", {
          with_genres: genreId,
          ...(options?.minRating ? { "vote_average.gte": options.minRating } : {}),
          ...(options?.minYear ? { "release_date.gte": `${options.minYear}-01-01` } : {}),
          ...(options?.maxYear ? { "release_date.lte": `${options.maxYear}-12-31` } : {}),
          sort_by: options?.sortBy || "popularity.desc",
          page: options?.page || 1,
          "vote_count.gte": 150,
          language: "en",
        });
        if (!response.ok) continue;

        const data: TMDBSearchResponse = await response.json();
        data.results.forEach((movie) => {
          if (!results.has(movie.id)) {
            results.set(movie.id, movie);
          }
        });
      } catch (error) {
        console.error(`Error searching genre ${genre}:`, error);
        continue;
      }
    }

    return rankDiscoverResults(Array.from(results.values()), preferredGenreIds);
  } catch (error) {
    console.error("TMDB discover error:", error);
    return [];
  }
}

/**
 * Enhanced search that combines multiple strategies
 * 1. Try genre-based discovery first (more precise)
 * 2. Fall back to text search
 * 3. Combine and deduplicate results
 */
export async function enhancedMovieSearch(intent: ParsedIntent): Promise<TMDBMovie[]> {
  const allResults: Map<number, TMDBMovie> = new Map(); // Use Map to deduplicate by ID
  const preferredGenres = Array.from(new Set(intent.genres));
  const preferredGenreIds = getGenreIdsForNames(preferredGenres);

  console.log("[Enhanced Search] Intent Analysis:", {
    effectiveMood: intent.mood,
    styles: intent.styleTags,
    genres: intent.genres,
    minRating: intent.minRating,
    minYear: intent.minYear,
    maxYear: intent.maxYear,
    keywords: intent.keywords,
    rawQuery: intent.rawQuery,
  });

  // Strategy 1: Genre-based discover (most precise)
  if (preferredGenres.length > 0) {
    console.log("[Enhanced Search] Strategy 1: Genre-based discover with genres:", preferredGenres);
    const discoverResults = await discoverMoviesByGenre(preferredGenres, {
      minRating: intent.minRating || undefined,
      minYear: intent.minYear || undefined,
      maxYear: intent.maxYear || undefined,
      sortBy: "popularity.desc",
    });

    console.log(`[Enhanced Search] ✅ Genre discover returned ${discoverResults.length} movies`);
    discoverResults.forEach((movie) => {
      if (!allResults.has(movie.id)) {
        allResults.set(movie.id, movie);
      }
    });
  }

  // Strategy 2: Keyword search (if genres didn't return enough results)
  const shouldUseTextSearch =
    Boolean(intent.cast || intent.director) ||
    (intent.keywords.length > 0 && preferredGenres.length === 0);

  if (allResults.size < 12 && shouldUseTextSearch) {
    let searchQuery = [intent.keywords.join(" "), intent.cast, intent.director]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!searchQuery && intent.mood) {
      searchQuery = intent.mood;
    }

    if (intent.minYear && intent.maxYear && intent.minYear === intent.maxYear) {
      searchQuery = `${searchQuery} ${intent.minYear}`.trim();
    }

    if (searchQuery) {
      console.log(`[Enhanced Search] Strategy 2: Keyword search for: "${searchQuery}"`);
      const searchResults = await searchMovies(searchQuery, 1);
      console.log(`[Enhanced Search] ✅ Keyword search returned ${searchResults.length} results`);

      searchResults.forEach((movie) => {
        const movieGenreIds = getMovieGenreIds(movie);

        if (preferredGenreIds.length > 0) {
          const genreMatch = movieGenreIds.some((genreId) => preferredGenreIds.includes(genreId));
          if (!genreMatch) {
            return;
          }
        }

        // Apply additional filters
        if (intent.minRating && movie.vote_average < intent.minRating) {
          console.log(
            `[Enhanced Search] ⛔ Filtering out "${movie.title}" (rating ${movie.vote_average} < ${intent.minRating})`
          );
          return;
        }
        if (intent.minYear && movie.release_date) {
          const year = parseInt(movie.release_date.split("-")[0]);
          if (year < intent.minYear) {
            console.log(`[Enhanced Search] ⛔ Filtering out "${movie.title}" (${year} < ${intent.minYear})`);
            return;
          }
        }
        if (intent.maxYear && movie.release_date) {
          const year = parseInt(movie.release_date.split("-")[0]);
          if (year > intent.maxYear) {
            console.log(`[Enhanced Search] ⛔ Filtering out "${movie.title}" (${year} > ${intent.maxYear})`);
            return;
          }
        }

        if (!allResults.has(movie.id)) {
          allResults.set(movie.id, movie);
        }
      });
    }
  }

  // Convert map back to array and sort by rating + popularity
  const results = rankDiscoverResults(Array.from(allResults.values()), preferredGenreIds);

  console.log(`[Enhanced Search] Final results: ${results.length} movies matched your request`);
  console.log(
    "[Enhanced Search] Top picks:",
    results.slice(0, 5).map((m) => `"${m.title}" (${m.vote_average})`)
  );

  return results;
}

export async function getMovieDetails(movieId: number) {
  const cached = movieDetailsCache.get(movieId);
  if (cached !== undefined) {
    return cached;
  }

  const blockedUntil = movieDetailsBlockedUntil.get(movieId) || 0;
  if (blockedUntil > Date.now()) {
    return null;
  }

  const inFlight = movieDetailsInFlight.get(movieId);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
  try {
    const response = await fetchTmdb(`movie/${movieId}`, {
      append_to_response: "credits",
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 60_000;
        movieDetailsBlockedUntil.set(movieId, Date.now() + waitMs);
      }
      console.warn(`TMDB movie details unavailable for ${movieId}: ${response.status}`);
      return null;
    }

    const data: TMDBDetailedMovie = await response.json();
    const normalized = normalizeMovieDetails(data);
    movieDetailsCache.set(movieId, normalized);
    return normalized;
  } catch (error) {
    console.error("TMDB detail error:", error);
    return null;
  } finally {
    movieDetailsInFlight.delete(movieId);
  }
  })();

  movieDetailsInFlight.set(movieId, request);
  return request;
}

export async function getSimilarMovies(movieId: number, limit: number = 10) {
  try {
    const response = await fetchTmdb(`movie/${movieId}/similar`);

    if (!response.ok) {
      throw new Error("Failed to fetch similar movies");
    }

    const data: TMDBSearchResponse = await response.json();

    return data.results.slice(0, limit).map((movie) => ({
      id: movie.id,
      title: movie.title,
      poster_url: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      backdrop_url: null,
      genres: null,
      director: null,
      actors: null,
      language: null,
      release_date: movie.release_date || null,
      overview: movie.overview || null,
      runtime: movie.runtime || null,
      rating: movie.vote_average || null,
      platforms: [],
      created_at: new Date().toISOString(),
      type: "movie" as const,
    }));
  } catch (error) {
    console.error("TMDB similar movies error:", error);
    return [];
  }
}

export function getTMDBImageUrl(
  path: string | null,
  size: "w300" | "w500" | "w780" | "original" = "w500"
) {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
