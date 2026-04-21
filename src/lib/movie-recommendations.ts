import { getUserMovieLogs, getUserWatchlist } from "./logs";
import { getUserTasteProfile } from "./user-taste";
import { getMovieDetails, searchMovies } from "./tmdb";
import { Content, MovieLogWithContent, TMDBMovie, UserTasteWithContent } from "@/types";

export interface RecommendationFilters {
  languages?: string[];
  actors?: string[];
  yearRange?: { from: number; to: number };
}

type ScoreMaps = {
  language: Map<string, number>;
  director: Map<string, number>;
  genre: Map<string, number>;
  cast: Map<string, number>;
};

function createScoreMaps(): ScoreMaps {
  return {
    language: new Map<string, number>(),
    director: new Map<string, number>(),
    genre: new Map<string, number>(),
    cast: new Map<string, number>(),
  };
}

function norm(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

function addWeight(map: Map<string, number>, key: string | null | undefined, value: number) {
  const k = norm(key);
  if (!k) return;
  map.set(k, (map.get(k) || 0) + value);
}

function addArrayWeight(map: Map<string, number>, values: string[] | null | undefined, value: number) {
  if (!values || values.length === 0) return;
  for (const item of values) {
    addWeight(map, item, value);
  }
}

function maxMapValue(map: Map<string, number>): number {
  if (map.size === 0) return 1;
  return Math.max(...Array.from(map.values()), 1);
}

function normalizedScore(map: Map<string, number>, key: string | null | undefined): number {
  const k = norm(key);
  if (!k || map.size === 0) return 0;
  return Math.min((map.get(k) || 0) / maxMapValue(map), 1);
}

function normalizedArrayScore(map: Map<string, number>, values: string[] | null | undefined): number {
  if (!values || values.length === 0 || map.size === 0) return 0;
  const top = values
    .map((v) => normalizedScore(map, v))
    .sort((a, b) => b - a)
    .slice(0, 3);
  if (top.length === 0) return 0;
  const avg = top.reduce((sum, s) => sum + s, 0) / top.length;
  return Math.min(avg, 1);
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((t) => t.length > 1)
  );
}

function isNearDuplicateTitle(candidate: string, knownTitles: string[]): boolean {
  const cNorm = normalizeTitle(candidate);
  const cTokens = titleTokens(candidate);

  for (const known of knownTitles) {
    const kNorm = normalizeTitle(known);
    if (!kNorm) continue;

    if (cNorm === kNorm) return true;
    if (cNorm.includes(kNorm) || kNorm.includes(cNorm)) {
      if (Math.min(cNorm.length, kNorm.length) >= 6) return true;
    }

    const kTokens = titleTokens(known);
    if (kTokens.size === 0 || cTokens.size === 0) continue;

    let overlap = 0;
    cTokens.forEach((t) => {
      if (kTokens.has(t)) overlap += 1;
    });
    const ratio = overlap / Math.max(cTokens.size, kTokens.size);
    if (ratio >= 0.75) return true;
  }

  return false;
}

function toMovieContent(movie: any): Content {
  return {
    id: movie.id,
    title: movie.title || movie.name || "Untitled",
    poster_url: movie.poster_url || null,
    backdrop_url: movie.backdrop_url || null,
    genres: movie.genres || [],
    platforms: movie.platforms || [],
    director: movie.director || null,
    actors: movie.actors || null,
    language: movie.language || null,
    release_date: movie.release_date || null,
    overview: movie.overview || null,
    runtime: movie.runtime || null,
    rating: movie.rating || null,
    created_at: new Date().toISOString(),
    type: "movie",
  };
}

function buildQueries(
  positive: ScoreMaps,
  fallbackGenres: string[],
  fallbackDirectors: string[],
  fallbackCast: string[]
): string[] {
  const topGenres = Array.from(positive.genre.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k);

  const topDirectors = Array.from(positive.director.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const topCast = Array.from(positive.cast.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k);

  const raw = [
    ...topDirectors,
    ...topGenres,
    ...topCast,
    ...fallbackDirectors,
    ...fallbackGenres,
    ...fallbackCast,
    "critically acclaimed movies",
    "must watch films",
  ];

  const dedup = new Set<string>();
  for (const q of raw) {
    const cleaned = q.trim();
    if (cleaned) dedup.add(cleaned);
  }

  return Array.from(dedup).slice(0, 16);
}

function scoreMovie(
  movie: any,
  positive: ScoreMaps,
  negative: ScoreMaps,
  preferredLanguages: string[],
  filters?: RecommendationFilters
): number {
  const lang = normalizedScore(positive.language, movie.language);
  const director = normalizedScore(positive.director, movie.director);
  const genre = normalizedArrayScore(positive.genre, movie.genres || []);
  const cast = normalizedArrayScore(positive.cast, movie.actors || []);

  // User-requested order: language > director > genre > cast
  let score = lang * 0.5 + director * 0.25 + genre * 0.15 + cast * 0.1;

  // Penalize patterns associated with bad reactions.
  const negLang = normalizedScore(negative.language, movie.language);
  const negDirector = normalizedScore(negative.director, movie.director);
  const negGenre = normalizedArrayScore(negative.genre, movie.genres || []);
  const negCast = normalizedArrayScore(negative.cast, movie.actors || []);
  score -= (negLang * 0.35 + negDirector * 0.25 + negGenre * 0.2 + negCast * 0.2) * 0.45;

  // Keep language prioritized but not hard-locked (balanced mode).
  if (preferredLanguages.length > 0) {
    const movieLang = norm(movie.language);
    const preferredSet = new Set(preferredLanguages.map(norm));
    if (!preferredSet.has(movieLang)) {
      score *= 0.65;
    }
  }

  if (filters?.languages && filters.languages.length > 0) {
    const langSet = new Set(filters.languages.map(norm));
    if (!langSet.has(norm(movie.language))) {
      score *= 0.55;
    }
  }

  if (filters?.actors && filters.actors.length > 0) {
    const actors = (movie.actors || []).map(norm);
    const hasActor = filters.actors.some((a) => actors.includes(norm(a)));
    if (!hasActor) {
      score *= 0.75;
    }
  }

  // Tiny quality tie-breaker.
  const quality = Math.max(0, Math.min((movie.rating || 0) / 10, 1));
  score += quality * 0.05;

  return score;
}

async function buildPreferenceSignals(userId: string) {
  const [logs, watchlist, tastes] = await Promise.all([
    getUserMovieLogs(userId, 500),
    getUserWatchlist(userId),
    getUserTasteProfile(userId),
  ]);

  const movieLogs = logs.filter((l) => l.content_type === "movie");
  const positiveLogs = movieLogs.filter((l) => !l.watch_later && (l.reaction === 1 || l.reaction === 2));
  const negativeLogs = movieLogs.filter((l) => !l.watch_later && l.reaction === 0);
  const movieTastes = tastes.filter((t) => t.content_type === "movie");

  const excludedIds = new Set<number>();
  movieLogs.forEach((l) => excludedIds.add(l.content_id));
  watchlist.filter((w) => w.content_type === "movie").forEach((w) => excludedIds.add(w.content_id));

  const positive = createScoreMaps();
  const negative = createScoreMaps();

  const knownTitles: string[] = [];

  const consume = (content: any, weight: number, target: ScoreMaps) => {
    if (!content) return;
    knownTitles.push(content.title || content.name || "");
    addWeight(target.language, content.language, weight);
    addWeight(target.director, content.director, weight);
    addArrayWeight(target.genre, content.genres, weight);
    addArrayWeight(target.cast, content.actors, weight);
  };

  movieTastes.forEach((t: UserTasteWithContent) => consume(t.content, 2.0, positive));
  positiveLogs.forEach((l: MovieLogWithContent) => consume(l.content, l.reaction === 2 ? 3.5 : 2.5, positive));
  negativeLogs.forEach((l: MovieLogWithContent) => consume(l.content, 2.5, negative));

  const preferredLanguages = Array.from(positive.language.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const fallbackGenres = movieTastes
    .flatMap((t) => t.content?.genres || [])
    .map(norm)
    .filter(Boolean)
    .slice(0, 8);

  const fallbackDirectors = movieTastes
    .map((t) => norm((t.content as any)?.director || ""))
    .filter(Boolean)
    .slice(0, 5);

  const fallbackCast = movieTastes
    .flatMap((t) => t.content?.actors || [])
    .map(norm)
    .filter(Boolean)
    .slice(0, 10);

  return {
    positive,
    negative,
    excludedIds,
    preferredLanguages,
    knownTitles: knownTitles.filter(Boolean),
    fallbackGenres,
    fallbackDirectors,
    fallbackCast,
  };
}

export async function getMovieRecommendations(
  userId: string,
  filters?: RecommendationFilters,
  limit: number = 20
): Promise<Content[]> {
  try {
    const signals = await buildPreferenceSignals(userId);

    const queries = buildQueries(
      signals.positive,
      signals.fallbackGenres,
      signals.fallbackDirectors,
      signals.fallbackCast
    );

    const rawMap = new Map<number, TMDBMovie>();

    for (const query of queries) {
      const results = await searchMovies(query, 1);
      for (const movie of results) {
        if (!signals.excludedIds.has(movie.id)) {
          rawMap.set(movie.id, movie);
        }
      }
    }

    const detailed = await Promise.all(
      Array.from(rawMap.values())
        .slice(0, 90)
        .map(async (m) => {
          const details = await getMovieDetails(m.id);
          if (!details) return null;
          return {
            ...details,
            rating: details.rating ?? m.vote_average ?? null,
          };
        })
    );

    const yearRange = filters?.yearRange || { from: 1900, to: new Date().getFullYear() };

    const filtered = detailed
      .filter((m): m is any => Boolean(m))
      .filter((m) => {
        const year = m.release_date ? parseInt(m.release_date.split("-")[0], 10) : 0;
        if (year && (year < yearRange.from || year > yearRange.to)) return false;

        if (signals.excludedIds.has(m.id)) return false;

        const title = m.title || "";
        if (isNearDuplicateTitle(title, signals.knownTitles)) return false;

        return true;
      })
      .map((m) => ({
        movie: m,
        score: scoreMovie(m, signals.positive, signals.negative, signals.preferredLanguages, filters),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => toMovieContent(entry.movie));

    return filtered;
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return [];
  }
}

export async function getNextRecommendationBatch(
  userId: string,
  filters?: RecommendationFilters,
  offset: number = 0
): Promise<Content[]> {
  // Pagination is intentionally simple for now; we fetch a larger set and slice by offset.
  const all = await getMovieRecommendations(userId, filters, Math.max(offset + 10, 30));
  return all.slice(offset, offset + 10);
}
