import { UserTasteWithContent } from "@/types";
import { getUserMovieLogs } from "@/lib/logs";

type MatchTaste = UserTasteWithContent & {
  notes?: string | null;
  source?: "taste" | "log";
};

function getContentGenres(taste: MatchTaste): string[] {
  if (!taste.content || !Array.isArray((taste.content as any).genres)) return [];
  return Array.from(
    new Set(
      (taste.content as any).genres
        .map((genre: string) => String(genre).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function getReactionWeight(reaction?: 0 | 1 | 2): number {
  if (reaction === 2) return 1.7;
  if (reaction === 1) return 0.85;
  if (reaction === 0) return -1.15;
  return 0.55;
}

function getSourceWeight(taste: MatchTaste): number {
  return taste.source === "log" ? 1.15 : 0.95;
}

function getRecencyWeight(addedAt?: string): number {
  if (!addedAt) return 1;
  const timestamp = new Date(addedAt).getTime();
  if (Number.isNaN(timestamp)) return 1;
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86400000);
  return 1 / (1 + ageDays / 90);
}

function getReviewSentiment(notes?: string | null): number {
  if (!notes) return 0;

  const positiveTerms = [
    "love",
    "loved",
    "amazing",
    "awesome",
    "beautiful",
    "brilliant",
    "excellent",
    "favorite",
    "favourite",
    "great",
    "good",
    "incredible",
    "masterpiece",
    "perfect",
    "wonderful",
    "fantastic",
    "solid",
    "nice",
    "enjoyed",
  ];

  const negativeTerms = [
    "bad",
    "boring",
    "awful",
    "terrible",
    "hate",
    "hated",
    "weak",
    "messy",
    "slow",
    "dull",
    "mid",
    "mess",
    "poor",
    "worse",
    "worst",
    "disappointing",
    "forgettable",
  ];

  const text = notes.toLowerCase();
  let score = 0;
  positiveTerms.forEach((term) => {
    if (text.includes(term)) score += 1;
  });
  negativeTerms.forEach((term) => {
    if (text.includes(term)) score -= 1;
  });

  return Math.max(-1, Math.min(1, score / 4));
}

function getTastePolarity(taste: MatchTaste): number {
  const reaction = getReactionWeight(taste.reaction);
  const sentiment = getReviewSentiment(taste.notes);
  return reaction + sentiment * 0.85;
}

function getTasteInfluence(taste: MatchTaste): number {
  const polarity = getTastePolarity(taste);
  const recency = getRecencyWeight(taste.added_at);
  const source = getSourceWeight(taste);
  return polarity * recency * source;
}

function buildWeightedGenreAffinities(tastes: MatchTaste[]): Map<string, number> {
  const genreWeights = new Map<string, number>();

  tastes.forEach((taste) => {
    const genres = getContentGenres(taste);
    if (genres.length === 0) return;

    const itemWeight = getTasteInfluence(taste);
    const spread = genres.length > 0 ? itemWeight / Math.sqrt(genres.length) : itemWeight;

    genres.forEach((genre) => {
      genreWeights.set(genre, (genreWeights.get(genre) || 0) + spread);
    });
  });

  const affinities = new Map<string, number>();
  genreWeights.forEach((value, genre) => {
    const stabilized = value / 2.4;
    const affinity = 1 / (1 + Math.exp(-stabilized));
    affinities.set(genre, affinity);
  });

  return affinities;
}

function averageRecentTasteMood(tastes: MatchTaste[], limit = 5): number | null {
  const recent = [...tastes]
    .filter((taste) => taste.added_at || taste.reaction !== undefined || taste.notes)
    .sort((a, b) => new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime())
    .slice(0, limit);

  if (recent.length === 0) return null;

  let total = 0;
  let totalWeight = 0;

  recent.forEach((taste, index) => {
    const polarity = getTastePolarity(taste);
    const recency = getRecencyWeight(taste.added_at);
    const decay = Math.max(0.5, 1 - index * 0.08);
    const weight = Math.max(0.2, recency * decay);
    total += polarity * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? total / totalWeight : null;
}

function averageTastePolarity(tastes: MatchTaste[]): number {
  if (tastes.length === 0) return 0;

  let total = 0;
  let totalWeight = 0;

  tastes.forEach((taste) => {
    const weight = Math.max(0.25, getRecencyWeight(taste.added_at) * getSourceWeight(taste));
    total += getTastePolarity(taste) * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? total / totalWeight : 0;
}

function calculateProfileConfidence(userATastes: MatchTaste[], userBTastes: MatchTaste[]): number {
  const minCount = Math.min(userATastes.length, userBTastes.length);
  return 0.72 + 0.28 * (1 - Math.exp(-minCount / 10));
}

function calculateExactOverlap(userATastes: MatchTaste[], userBTastes: MatchTaste[]): number {
  if (userATastes.length === 0 || userBTastes.length === 0) return 0;

  const idsA = new Set(userATastes.map((taste) => `${taste.content_type}-${taste.content_id}`));
  let shared = 0;

  userBTastes.forEach((taste) => {
    if (idsA.has(`${taste.content_type}-${taste.content_id}`)) {
      shared += 1;
    }
  });

  const denominator = Math.max(1, Math.min(userATastes.length, userBTastes.length));
  return Math.min(1, shared / denominator);
}

/**
 * Calculate GenreSim (0-1)
 * Weighted genre affinity similarity. Genres are influenced by
 * explicit taste, log reaction, review sentiment, and recency.
 */
export function calculateGenreSim(
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
): number {
  const profileA = buildWeightedGenreAffinities(userATastes);
  const profileB = buildWeightedGenreAffinities(userBTastes);

  const allGenres = new Set([...profileA.keys(), ...profileB.keys()]);
  if (allGenres.size === 0) return 0;

  let similarity = 0;
  let totalWeight = 0;
  allGenres.forEach((genre) => {
    const affinityA = profileA.get(genre) ?? 0.5;
    const affinityB = profileB.get(genre) ?? 0.5;
    const diff = Math.min(1, Math.abs(affinityA - affinityB));
    const strength = Math.max(Math.abs(affinityA - 0.5), Math.abs(affinityB - 0.5));
    const weight = 0.35 + strength;
    similarity += (1 - diff) * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? Math.max(0, Math.min(1, similarity / totalWeight)) : 0;
}

/**
 * Calculate RatingSim (0-1)
 * Based on how similar the users' review/reaction polarity is.
 */
export function calculateRatingSim(
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
): number {
  if (userATastes.length === 0 || userBTastes.length === 0) return 0;

  const avgA = averageTastePolarity(userATastes);
  const avgB = averageTastePolarity(userBTastes);

  // Same reaction style = closer to 1, very different reaction style = closer to 0.
  const normalizedDiff = Math.min(3, Math.abs(avgA - avgB));
  return Math.max(0, 1 - normalizedDiff / 3);
}

/**
 * Calculate VibeSim (0-1)
 * Based on mood tags and genre diversity
 * Estimates compatibility from genre distribution
 */
export function calculateVibeSim(
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
): number {
  const vibeA = averageRecentTasteMood(userATastes);
  const vibeB = averageRecentTasteMood(userBTastes);

  if (vibeA === null || vibeB === null) {
    const genresA = new Set(buildWeightedGenreAffinities(userATastes).keys());
    const genresB = new Set(buildWeightedGenreAffinities(userBTastes).keys());

    if (genresA.size === 0 || genresB.size === 0) return 0;

    const diversityA = Math.min(genresA.size, 10) / 10;
    const diversityB = Math.min(genresB.size, 10) / 10;
    return ((diversityA + diversityB) / 2) * 0.7 + 0.3;
  }

  const diff = Math.min(3, Math.abs(vibeA - vibeB));
  return Math.max(0, 1 - diff / 3);
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
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
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
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
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
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
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
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
): MatchScoreBreakdown {
  const genreSim = calculateGenreSim(userATastes, userBTastes);
  const ratingSim = calculateRatingSim(userATastes, userBTastes);
  const vibeSim = calculateVibeSim(userATastes, userBTastes);
  const creatorSim = calculateCreatorSim(userATastes, userBTastes);
  const eraSim = calculateEraSim(userATastes, userBTastes);
  const languageSim = calculateLanguageSim(userATastes, userBTastes);

  const exactOverlap = calculateExactOverlap(userATastes, userBTastes);
  const confidence = calculateProfileConfidence(userATastes, userBTastes);
  const weightedScore =
    0.34 * genreSim +
    0.18 * ratingSim +
    0.12 * vibeSim +
    0.16 * creatorSim +
    0.10 * eraSim +
    0.06 * languageSim;
  const totalScore = 100 * Math.min(1, weightedScore * confidence + exactOverlap * 0.10);

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
  tastes: MatchTaste[]
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
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
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
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[]
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
  userATastes: MatchTaste[],
  userBTastes: MatchTaste[],
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
