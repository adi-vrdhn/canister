import { UserTasteWithContent } from "@/types";
import { getUserMovieLogs } from "@/lib/logs";

/**
 * Extract genres from user's taste movies as a Set
 */
function getUserGenresSet(tastes: UserTasteWithContent[]): Set<string> {
  const genres = new Set<string>();

  tastes.forEach((taste) => {
    if (taste.content && Array.isArray((taste.content as any).genres)) {
      const contentGenres = (taste.content as any).genres;
      contentGenres.forEach((genre: string) => {
        genres.add(genre.toLowerCase());
      });
    }
  });

  return genres;
}

/**
 * Calculate GenreSim (0-1)
 * Jaccard similarity of genres (better than cosine for categorical data)
 */
export function calculateGenreSim(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[]
): number {
  const genresA = getUserGenresSet(userATastes);
  const genresB = getUserGenresSet(userBTastes);

  if (genresA.size === 0 || genresB.size === 0) return 0;

  // Intersection - common genres
  const intersection = Array.from(genresA).filter((g) => genresB.has(g));

  // Union - all unique genres
  const union = new Set([...genresA, ...genresB]);

  // Jaccard similarity = intersection / union
  const jaccard = intersection.length / union.size;
  
  // Boost the score - genres are fundamental to taste
  // If they share even 1 genre out of many, it's meaningful
  return Math.min(1, jaccard * 1.5);
}

/**
 * Calculate RatingSim (0-1)
 * Based on average rating difference
 * Currently assumes all movies in taste are rated equally (1.0)
 * This will improve when explicit ratings are implemented
 */
export function calculateRatingSim(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[]
): number {
  // For now, assume all movies in taste are "good" (rating 1)
  // Give baseline of 0.8 to account for rating uncertainty
  // This will be enhanced when we add explicit ratings
  return 0.8;
}

/**
 * Calculate VibeSim (0-1)
 * Based on mood tags and genre diversity
 * Estimates compatibility from genre distribution
 */
export function calculateVibeSim(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[]
): number {
  // If both users have diverse genre tastes, they likely have compatible vibes
  const genresA = getUserGenresSet(userATastes);
  const genresB = getUserGenresSet(userBTastes);

  if (genresA.size === 0 || genresB.size === 0) return 0;

  // Users with diverse tastes (many genres) are more likely compatible
  // Genre diversity is a proxy for vibe compatibility
  const diversityA = Math.min(genresA.size, 10) / 10; // Max at 10 genres
  const diversityB = Math.min(genresB.size, 10) / 10;

  // Average diversity similarity
  const diversitySim = (diversityA + diversityB) / 2;

  // Weight: 70% genre diversity, 30% baseline confidence
  return diversitySim * 0.7 + 0.3;
}

/**
 * Extract creators (actors + directors) from taste
 */
function getUserCreators(tastes: UserTasteWithContent[]): Set<string> {
  const creators = new Set<string>();

  tastes.forEach((taste) => {
    if (taste.content && typeof taste.content === "object") {
      const content = taste.content as any;

      // Add director
      if (content.director) {
        creators.add(`dir:${content.director.toLowerCase()}`);
      }

      // Add actors (when available)
      if (Array.isArray(content.actors)) {
        content.actors.forEach((actor: string) => {
          creators.add(`act:${actor.toLowerCase()}`);
        });
      }
    }
  });

  return creators;
}

/**
 * Calculate CreatorSim (0-1)
 * Jaccard similarity of actors + directors
 * Boosted because shared creators are very meaningful
 */
export function calculateCreatorSim(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[]
): number {
  const creatorsA = getUserCreators(userATastes);
  const creatorsB = getUserCreators(userBTastes);

  if (creatorsA.size === 0 || creatorsB.size === 0) return 0;

  // Intersection
  const intersection = Array.from(creatorsA).filter((c) => creatorsB.has(c));

  // Union
  const union = new Set([...creatorsA, ...creatorsB]);

  // Jaccard similarity = intersection / union
  const jaccard = intersection.length / union.size;
  
  // Boost significantly - shared creators are very meaningful
  return Math.min(1, jaccard * 2.5);
}

/**
 * Extract average year from taste
 */
function getAverageYear(tastes: UserTasteWithContent[]): number {
  if (tastes.length === 0) return 2020;

  let totalYear = 0;
  let count = 0;

  tastes.forEach((taste) => {
    if (taste.content && typeof taste.content === "object") {
      const content = taste.content as any;
      if (content.release_date) {
        const year = new Date(content.release_date).getFullYear();
        if (!isNaN(year)) {
          totalYear += year;
          count++;
        }
      }
    }
  });

  return count > 0 ? totalYear / count : 2020;
}

/**
 * Calculate EraSim (0-1)
 * Based on average release year difference
 * More lenient - people within ~20 years are similar
 */
export function calculateEraSim(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[]
): number {
  const avgYearA = getAverageYear(userATastes);
  const avgYearB = getAverageYear(userBTastes);

  const yearDiff = Math.abs(avgYearA - avgYearB);
  // Within 20 years = 100% match, at 40 years = 50% match
  return Math.max(0, 1 - yearDiff / 40);
}

/**
 * Extract languages from taste
 */
function getUserLanguages(tastes: UserTasteWithContent[]): Set<string> {
  const languages = new Set<string>();

  tastes.forEach((taste) => {
    if (taste.content && typeof taste.content === "object") {
      const content = taste.content as any;
      if (content.language) {
        languages.add(content.language.toLowerCase());
      }
    }
  });

  return languages;
}

/**
 * Calculate LanguageSim (0-1)
 * Jaccard similarity of languages
 * Boosted because shared language preference is meaningful
 */
export function calculateLanguageSim(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[]
): number {
  const languagesA = getUserLanguages(userATastes);
  const languagesB = getUserLanguages(userBTastes);

  if (languagesA.size === 0 || languagesB.size === 0) return 0;

  // Intersection
  const intersection = Array.from(languagesA).filter((l) => languagesB.has(l));

  // Union
  const union = new Set([...languagesA, ...languagesB]);

  // Jaccard similarity
  const jaccard = intersection.length / union.size;
  
  // Boost significantly
  return Math.min(1, jaccard * 2.0);
}

/**
 * Calculate overall match score (0-100)
 * Formula:
 * Score = 100 × (
 *   0.35 × GenreSim +
 *   0.20 × RatingSim +
 *   0.15 × VibeSim +
 *   0.15 × CreatorSim +
 *   0.10 × EraSim +
 *   0.05 × LanguageSim
 * )
 */
export interface MatchScoreBreakdown {
  genreSim: number;
  ratingSim: number;
  vibeSim: number;
  creatorSim: number;
  eraSim: number;
  languageSim: number;
  totalScore: number;
}

/**
 * Comprehensive match analysis with detailed breakdown
 */
export interface MatchAnalysis extends MatchScoreBreakdown {
  // Personality & Overview
  blendPersonality: string;

  // Taste Similarity
  sharedGenres: string[];
  genreMismatch: string | null;

  // Shared Watching - Two types of common movies
  commonTasteMovies: Array<{
    id: number;
    title: string;
    poster_url: string | null;
    type: "movie" | "tv";
  }>;
  commonTasteMovieCount: number;
  
  commonMasterpieceMovies: Array<{
    id: number;
    title: string;
    poster_url: string | null;
    type: "movie" | "tv";
  }>;
  commonMasterpieceMovieCount: number;

  // Creators
  commonActors: string[];
  commonDirectors: string[];
  topSharedCreator: string | null;

  // Taste DNA
  genreDistributionA: { genre: string; count: number }[];
  genreDistributionB: { genre: string; count: number }[];
  dominantGenreA: string | null;
  dominantGenreB: string | null;

  // Preferences
  avgYearA: number;
  avgYearB: number;
  languagesA: string[];
  languagesB: string[];
  sharedLanguages: string[];

  // Fun Stats
  tasteInsight: string;
}

export function calculateMatchScore(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[]
): MatchScoreBreakdown {
  const genreSim = calculateGenreSim(userATastes, userBTastes);
  const ratingSim = calculateRatingSim(userATastes, userBTastes);
  const vibeSim = calculateVibeSim(userATastes, userBTastes);
  const creatorSim = calculateCreatorSim(userATastes, userBTastes);
  const eraSim = calculateEraSim(userATastes, userBTastes);
  const languageSim = calculateLanguageSim(userATastes, userBTastes);

  const totalScore = 100 * (
    0.35 * genreSim +
    0.20 * ratingSim +
    0.15 * vibeSim +
    0.15 * creatorSim +
    0.10 * eraSim +
    0.05 * languageSim
  );

  return {
    genreSim: Math.round(genreSim * 100),
    ratingSim: Math.round(ratingSim * 100),
    vibeSim: Math.round(vibeSim * 100),
    creatorSim: Math.round(creatorSim * 100),
    eraSim: Math.round(eraSim * 100),
    languageSim: Math.round(languageSim * 100),
    totalScore: Math.round(totalScore),
  };
}

/**
 * Get genre distribution from tastes
 */
function getGenreDistribution(
  tastes: UserTasteWithContent[]
): { genre: string; count: number }[] {
  const genreCounts = new Map<string, number>();

  tastes.forEach((taste) => {
    if (taste.content && Array.isArray((taste.content as any).genres)) {
      const genres = (taste.content as any).genres;
      genres.forEach((genre: string) => {
        const g = genre.toLowerCase();
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      });
    }
  });

  return Array.from(genreCounts.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Generate personality tag based on dominant genres
 */
function generateBlendPersonality(distributionA: { genre: string; count: number }[], distributionB: { genre: string; count: number }[]): string {
  if (distributionA.length === 0 || distributionB.length === 0) return "Movie Enthusiasts";

  const topA = distributionA[0]?.genre || "";
  const topB = distributionB[0]?.genre || "";

  if (topA === topB) {
    return `${topA.charAt(0).toUpperCase() + topA.slice(1)} Devotees`;
  }

  return `${topA.charAt(0).toUpperCase() + topA.slice(1)} & ${topB.charAt(0).toUpperCase() + topB.slice(1)} Mix`;
}

/**
 * Get common masterpiece movies between two users (from their logs)
 * Filters to only show movies both users have rated as masterpiece (reaction === 2)
 */
export async function getCommonMasterpieceMovies(
  userAId: string,
  userBId: string
): Promise<
  Array<{
    id: number;
    title: string;
    poster_url: string | null;
    type: "movie" | "tv";
  }>
> {
  try {
    // Fetch logs for both users
    const logsA = await getUserMovieLogs(userAId, 500);
    const logsB = await getUserMovieLogs(userBId, 500);

    // Filter to only masterpiece ratings
    const masterpieceA = logsA.filter((log) => log.reaction === 2);
    const masterpieceB = logsB.filter((log) => log.reaction === 2);

    // Find common content_ids
    const idsA = new Set(masterpieceA.map((log) => `${log.content_type}-${log.content_id}`));
    const commonIds = new Set(
      masterpieceB
        .filter((log) => idsA.has(`${log.content_type}-${log.content_id}`))
        .map((log) => `${log.content_type}-${log.content_id}`)
    );

    // Get full content for common masterpiece movies
    const commonMovies = masterpieceA
      .filter((log) => commonIds.has(`${log.content_type}-${log.content_id}`))
      .map((log) => ({
        id: log.content_id,
        title: (log.content as any)?.title || (log.content as any)?.name || "Unknown",
        poster_url: (log.content as any)?.poster_url || null,
        type: (log.content_type as "movie" | "tv") || "movie",
      }))
      // Remove duplicates
      .filter((movie, index, self) => index === self.findIndex((m) => m.id === movie.id && m.type === movie.type));

    return commonMovies;
  } catch (error) {
    console.error("Error fetching common masterpiece movies:", error);
    return [];
  }
}

/**
 * Get common taste profile movies between two users
 * Returns movies that are in BOTH users' taste profiles
 */
export function getCommonTasteMovies(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[]
): Array<{
  id: number;
  title: string;
  poster_url: string | null;
  type: "movie" | "tv";
}> {
  const idsA = new Set(userATastes.map((t) => t.content_id));
  const commonIds = new Set(
    userBTastes
      .filter((t) => idsA.has(t.content_id))
      .map((t) => t.content_id)
  );

  // Get full content for common movies
  const commonMovies = userATastes
    .filter((t) => commonIds.has(t.content_id))
    .map((taste) => ({
      id: taste.content_id,
      title: (taste.content as any)?.title || (taste.content as any)?.name || "Unknown",
      poster_url: (taste.content as any)?.poster_url || null,
      type: (taste.content_type as "movie" | "tv") || "movie",
    }));

  return commonMovies;
}

/**
 * Get common movies with full details
 */
function getCommonMoviesWithDetails(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[]
): Array<{
  id: number;
  title: string;
  poster_url: string | null;
  type: "movie" | "tv";
}> {
  const idsA = new Set(userATastes.map((t) => t.content_id));
  const commonIds = new Set(
    userBTastes
      .filter((t) => idsA.has(t.content_id))
      .map((t) => t.content_id)
  );

  // Get full content for common movies
  const commonMovies = userATastes
    .filter((t) => commonIds.has(t.content_id))
    .map((taste) => ({
      id: taste.content_id,
      title: (taste.content as any)?.title || (taste.content as any)?.name || "Unknown",
      poster_url: (taste.content as any)?.poster_url || null,
      type: (taste.content_type as "movie" | "tv") || "movie",
    }));

  return commonMovies;
}

/**
 * Generate comprehensive match analysis
 */
export async function generateMatchAnalysis(
  userATastes: UserTasteWithContent[],
  userBTastes: UserTasteWithContent[],
  userAId: string,
  userBId: string
): Promise<MatchAnalysis> {
  // Basic score
  const score = calculateMatchScore(userATastes, userBTastes);

  // Genre analysis
  const genreDistA = getGenreDistribution(userATastes);
  const genreDistB = getGenreDistribution(userBTastes);

  // Shared genres
  const genresA = new Set(genreDistA.map((g) => g.genre));
  const genresB = new Set(genreDistB.map((g) => g.genre));
  const sharedGenres = Array.from(genresA).filter((g) => genresB.has(g));
  const uniqueA = Array.from(genresA).filter((g) => !genresB.has(g));
  const genreMismatch = uniqueA.length > 0 ? uniqueA[0] : null;

  // Creators
  const creatorsA = getUserCreators(userATastes);
  const creatorsB = getUserCreators(userBTastes);
  const commonCreators = Array.from(creatorsA).filter((c) => creatorsB.has(c));
  const commonActors = commonCreators.filter((c) => c.startsWith("act:")).map((c) => c.slice(4));
  const commonDirectors = commonCreators.filter((c) => c.startsWith("dir:")).map((c) => c.slice(4));
  const topSharedCreator = commonCreators.length > 0 ? commonCreators[0] : null;

  // Common taste profile movies
  const commonTasteMovies = getCommonTasteMovies(userATastes, userBTastes);
  
  // Common masterpiece movies (both users rated as masterpiece)
  const commonMasterpieceMovies = await getCommonMasterpieceMovies(userAId, userBId);

  // Years
  const avgYearA = getAverageYear(userATastes);
  const avgYearB = getAverageYear(userBTastes);

  // Languages
  const langsA = Array.from(getUserLanguages(userATastes));
  const langsB = Array.from(getUserLanguages(userBTastes));
  const sharedLangs = langsA.filter((l) => langsB.includes(l));

  // Insight
  const tasteInsight =
    score.totalScore >= 75
      ? "You're cinematic soulmates!"
      : score.totalScore >= 50
      ? "Great taste overlap with some unique differences"
      : "Interesting contrast - learn from each other!";

  return {
    ...score,
    blendPersonality: generateBlendPersonality(genreDistA, genreDistB),
    sharedGenres,
    genreMismatch,
    commonTasteMovies: commonTasteMovies,
    commonTasteMovieCount: commonTasteMovies.length,
    commonMasterpieceMovies: commonMasterpieceMovies,
    commonMasterpieceMovieCount: commonMasterpieceMovies.length,
    commonActors,
    commonDirectors,
    topSharedCreator,
    genreDistributionA: genreDistA,
    genreDistributionB: genreDistB,
    dominantGenreA: genreDistA[0]?.genre || null,
    dominantGenreB: genreDistB[0]?.genre || null,
    avgYearA: Math.round(avgYearA),
    avgYearB: Math.round(avgYearB),
    languagesA: langsA,
    languagesB: langsB,
    sharedLanguages: sharedLangs,
    tasteInsight,
  };
}
