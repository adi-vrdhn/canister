import { TMDBMovie, TMDBSearchResponse } from "@/types";
import { ParsedIntent } from "./nlp-parser";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

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

export async function searchMovies(query: string, page: number = 1) {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(
        query
      )}&page=${page}`
    );

    if (!response.ok) {
      throw new Error("Failed to search movies");
    }

    const data: TMDBSearchResponse = await response.json();
    return data.results;
  } catch (error) {
    console.error("TMDB search error:", error);
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

    // Search for each genre separately to use OR logic instead of AND
    for (const genre of genres) {
      const genreId = GENRE_MAP[genre.toLowerCase()];
      if (!genreId) continue;

      let url = `${TMDB_BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}`;

      if (options?.minRating) {
        url += `&vote_average.gte=${options.minRating}`;
      }
      if (options?.minYear) {
        url += `&release_date.gte=${options.minYear}-01-01`;
      }
      if (options?.maxYear) {
        url += `&release_date.lte=${options.maxYear}-12-31`;
      }

      url += `&sort_by=${options?.sortBy || "vote_average.desc"}`;
      url += `&page=${options?.page || 1}`;
      url += "&vote_count.gte=100"; // Only highly-rated movies with enough votes
      url += "&language=en";

      try {
        const response = await fetch(url);
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

    return Array.from(results.values());
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

  console.log("[Enhanced Search] Intent Analysis:", {
    effectiveMood: intent.mood,
    genres: intent.genres,
    minRating: intent.minRating,
    minYear: intent.minYear,
    maxYear: intent.maxYear,
    keywords: intent.keywords,
    rawQuery: intent.rawQuery,
  });

  // Strategy 1: Genre-based discover (most precise)
  if (intent.genres && intent.genres.length > 0) {
    console.log("[Enhanced Search] Strategy 1: Genre-based discover with genres:", intent.genres);
    const discoverResults = await discoverMoviesByGenre(intent.genres, {
      minRating: intent.minRating || 5,
      minYear: intent.minYear || undefined,
      maxYear: intent.maxYear || undefined,
      sortBy: "vote_average.desc",
    });

    console.log(`[Enhanced Search] ✅ Genre discover returned ${discoverResults.length} movies`);
    discoverResults.forEach((movie) => {
      if (!allResults.has(movie.id)) {
        allResults.set(movie.id, movie);
      }
    });
  }

  // Strategy 2: Keyword search (if genres didn't return enough results)
  if (allResults.size < 12 && (intent.keywords.length > 0 || intent.mood)) {
    let searchQuery = intent.keywords.join(" ");

    if (!searchQuery && intent.mood) {
      searchQuery = intent.mood;
    }

    if (searchQuery) {
      console.log(`[Enhanced Search] Strategy 2: Keyword search for: "${searchQuery}"`);
      const searchResults = await searchMovies(searchQuery, 1);
      console.log(`[Enhanced Search] ✅ Keyword search returned ${searchResults.length} results`);

      searchResults.forEach((movie) => {
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
  const results = Array.from(allResults.values()).sort((a, b) => {
    const ratingDiff = (b.vote_average || 0) - (a.vote_average || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return (b.popularity || 0) - (a.popularity || 0);
  });

  console.log(`[Enhanced Search] Final results: ${results.length} movies matched your request`);
  console.log(
    "[Enhanced Search] Top picks:",
    results.slice(0, 5).map((m) => `"${m.title}" (${m.vote_average})`)
  );

  return results;
}

export async function getMovieDetails(movieId: number) {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}?api_key=${API_KEY}&append_to_response=credits`
    );

    if (!response.ok) {
      console.warn(`TMDB movie details unavailable for ${movieId}: ${response.status}`);
      return null;
    }

    const data: TMDBDetailedMovie = await response.json();

    // Extract director from credits
    let director: string | null = null;
    let actors: string[] | null = null;
    
    if ((data as any).credits && (data as any).credits.crew) {
      const directorObj = (data as any).credits.crew.find(
        (person: any) => person.job === "Director"
      );
      director = directorObj?.name || null;
    }

    // Extract top 5 actors
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
      platforms: [], // TMDB doesn't provide this in basic API
    };
  } catch (error) {
    console.error("TMDB detail error:", error);
    return null;
  }
}

export async function getSimilarMovies(movieId: number, limit: number = 10) {
  try {
    const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}/similar?api_key=${API_KEY}`);

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
