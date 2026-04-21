import { UserTasteWithContent } from "@/types";

/**
 * Calculate similarity score between two users based on their taste profiles
 * Weights: Language (30%) → Director (25%) → Genre (25%) → Cast (20%)
 * Returns score 0-100
 */
export async function calculateTasteMatchScore(
  user1Tastes: UserTasteWithContent[],
  user2Tastes: UserTasteWithContent[]
): Promise<number> {
  if (user1Tastes.length === 0 || user2Tastes.length === 0) {
    return 0;
  }

  // Extract data from both users
  const user1Data = extractTasteData(user1Tastes);
  const user2Data = extractTasteData(user2Tastes);

  // Calculate scores for each criterion
  const languageScore = calculateLanguageMatch(user1Data.languages, user2Data.languages);
  const directorScore = calculateDirectorMatch(user1Data.directors, user2Data.directors);
  const genreScore = calculateGenreMatch(user1Data.genres, user2Data.genres);
  const castScore = calculateCastMatch(user1Data.casts, user2Data.casts);

  // Weighted average
  const totalScore =
    languageScore * 0.3 +
    directorScore * 0.25 +
    genreScore * 0.25 +
    castScore * 0.2;

  return Math.round(totalScore);
}

/**
 * Extract relevant data from taste profile
 */
function extractTasteData(tastes: UserTasteWithContent[]): {
  languages: string[];
  directors: string[];
  genres: string[];
  casts: string[];
} {
  const languages: Set<string> = new Set();
  const directors: Set<string> = new Set();
  const genres: Set<string> = new Set();
  const casts: Set<string> = new Set();

  tastes.forEach((taste) => {
    const content = taste.content;

    // Language - infer from release_date region or default to English
    if (content && typeof content === "object") {
      languages.add("English"); // TODO: Expand with actual language detection
    }

    // Director
    if (content && typeof content === "object" && "director" in content) {
      const director = (content as any).director;
      if (director) directors.add(director);
    }

    // Genres
    if (content && typeof content === "object" && "genres" in content) {
      const genres_list = (content as any).genres;
      if (Array.isArray(genres_list)) {
        genres_list.forEach((g) => genres.add(g));
      }
    }

    // Cast - would need additional API calls to fetch full cast info
    // For now, we'll leave this as a placeholder
    // TODO: Implement cast extraction from TMDB/TVMaze API
  });

  return {
    languages: Array.from(languages),
    directors: Array.from(directors),
    genres: Array.from(genres),
    casts: Array.from(casts),
  };
}

/**
 * Calculate language similarity (0-100)
 */
function calculateLanguageMatch(languages1: string[], languages2: string[]): number {
  if (languages1.length === 0 || languages2.length === 0) return 0;

  const set1 = new Set(languages1);
  const set2 = new Set(languages2);

  const intersection = Array.from(set1).filter((x) => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  return (intersection / union) * 100;
}

/**
 * Calculate director similarity (0-100)
 */
function calculateDirectorMatch(directors1: string[], directors2: string[]): number {
  if (directors1.length === 0 || directors2.length === 0) return 0;

  const set1 = new Set(directors1);
  const set2 = new Set(directors2);

  const intersection = Array.from(set1).filter((x) => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  // Boost director matches since they have strong creative influence
  return Math.min(100, ((intersection / union) * 100) * 1.2);
}

/**
 * Calculate genre similarity (0-100)
 */
function calculateGenreMatch(genres1: string[], genres2: string[]): number {
  if (genres1.length === 0 || genres2.length === 0) return 0;

  const set1 = new Set(genres1);
  const set2 = new Set(genres2);

  const intersection = Array.from(set1).filter((x) => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  return (intersection / union) * 100;
}

/**
 * Calculate cast similarity (0-100)
 */
function calculateCastMatch(casts1: string[], casts2: string[]): number {
  if (casts1.length === 0 || casts2.length === 0) return 0;

  const set1 = new Set(casts1);
  const set2 = new Set(casts2);

  const intersection = Array.from(set1).filter((x) => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  return (intersection / union) * 100;
}

/**
 * Get breakdown of match score (for showing details)
 */
import { getMovieDetails } from "./tmdb";

export async function getMatchScoreBreakdown(
  user1Tastes: UserTasteWithContent[],
  user2Tastes: UserTasteWithContent[]
): Promise<{
  totalScore: number;
  language: number;
  director: number;
  genre: number;
  cast: number;
  details: {
    commonDirectors: string[];
    commonGenres: string[];
    contrarianMovies?: { id: number; title: string; tmdbRating: number }[];
    contrarianBadge?: boolean;
  };
}> {
  if (user1Tastes.length === 0 || user2Tastes.length === 0) {
    return {
      totalScore: 0,
      language: 0,
      director: 0,
      genre: 0,
      cast: 0,
      details: {
        commonDirectors: [],
        commonGenres: [],
      },
    };
  }

  // Extract data
  const user1Data = extractTasteData(user1Tastes);
  const user2Data = extractTasteData(user2Tastes);

  // Calculate individual scores
  const language = calculateLanguageMatch(user1Data.languages, user2Data.languages);
  const director = calculateDirectorMatch(user1Data.directors, user2Data.directors);
  const genre = calculateGenreMatch(user1Data.genres, user2Data.genres);
  const cast = calculateCastMatch(user1Data.casts, user2Data.casts);

  // Find common elements
  const commonDirectors = Array.from(new Set(user1Data.directors)).filter((d) =>
    user2Data.directors.includes(d)
  );
  const commonGenres = Array.from(new Set(user1Data.genres)).filter((g) =>
    user2Data.genres.includes(g)
  );

  // Total score
  const totalScore = Math.round(language * 0.3 + director * 0.25 + genre * 0.25 + cast * 0.2);

  // Contrarian Buddies badge logic
  // Find movies both users rated highly (reaction 2 or 1), but TMDB avg rating < 5
  const user1High = user1Tastes.filter((t) => t.reaction === 2 || t.reaction === 1);
  const user2High = user2Tastes.filter((t) => t.reaction === 2 || t.reaction === 1);
  const contrarianMovies: { id: number; title: string; tmdbRating: number }[] = [];

  for (const t1 of user1High) {
    const match = user2High.find(
      (t2) => t2.content_id === t1.content_id && t2.content_type === t1.content_type
    );
    if (match && t1.content_id && t1.content_type === "movie") {
      // Fetch TMDB rating
      const tmdb = await getMovieDetails(Number(t1.content_id));
      if (tmdb && typeof tmdb.rating === "number" && tmdb.rating < 5) {
        contrarianMovies.push({ id: tmdb.id, title: tmdb.title, tmdbRating: tmdb.rating });
      }
    }
  }

  return {
    totalScore,
    language: Math.round(language),
    director: Math.round(director),
    genre: Math.round(genre),
    cast: Math.round(cast),
    details: {
      commonDirectors,
      commonGenres,
      contrarianMovies: contrarianMovies.length > 0 ? contrarianMovies : undefined,
      contrarianBadge: contrarianMovies.length > 0,
    },
  };
}
