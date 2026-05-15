import { fetchTmdb } from "./tmdb-transport";
import { readBrowserCacheEntry, writeBrowserCache } from "./browser-cache";

const TVMAZE_BASE_URL = "https://api.tvmaze.com";
const LIKELY_TMDB_TV_ID_THRESHOLD = 100000;
const showSearchRefreshInFlight = new Map<string, Promise<ShowDetails[]>>();
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;

export interface TVMazeShow {
  id: number;
  name: string;
  image?: {
    medium?: string;
    original?: string;
  };
  summary?: string;
  premiered?: string;
  runtime?: number;
  rating?: {
    average?: number;
  };
  genres?: string[];
  status?: string;
  network?: {
    name?: string;
  };
}

export interface TVMazeCreditPerson {
  id: number;
  name: string;
  image?: {
    medium?: string;
    original?: string;
  };
}

export interface TVMazeCastCredit {
  person: TVMazeCreditPerson;
  character?: {
    name?: string;
  };
}

export interface TVMazeCrewCredit {
  person: TVMazeCreditPerson;
  type?: string;
}

export interface ShowDetails extends TVMazeShow {
  type: "tv";
  title?: string;
  poster_url?: string;
  poster_path?: string;
  overview?: string;
  release_date?: string;
  language?: string;
  cast_details?: Array<{
    id: number;
    name: string;
    profile_url: string | null;
    character?: string | null;
    job?: string | null;
    department?: string | null;
  }>;
  crew_details?: Array<{
    id: number;
    name: string;
    profile_url: string | null;
    character?: string | null;
    job?: string | null;
    department?: string | null;
  }>;
}

type TVMazeMappedCreditPerson = NonNullable<ShowDetails["cast_details"]>[number];

interface TMDBTVSearchResult {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview?: string;
  first_air_date?: string;
  vote_average?: number;
  popularity?: number;
  episode_run_time?: number[];
  status?: string;
  networks?: Array<{ name?: string }>;
  original_language?: string;
}

interface TMDBTVSearchResponse {
  results: TMDBTVSearchResult[];
}

interface TMDBTVDetails {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Array<{ id: number; name: string }>;
  overview: string;
  first_air_date: string;
  episode_run_time?: number[];
  vote_average?: number;
  status?: string;
  networks?: Array<{ name?: string }>;
  origin_country?: string[];
  original_language?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getShowSearchCacheKey(query: string): string {
  return `tv-search:${normalizeSearchText(query)}`;
}

function dedupeShows(shows: ShowDetails[]): ShowDetails[] {
  const seen = new Map<number, ShowDetails>();
  shows.forEach((show) => {
    if (!seen.has(show.id)) {
      seen.set(show.id, show);
    }
  });
  return Array.from(seen.values());
}

function rankShows(shows: ShowDetails[], query: string): ShowDetails[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return shows;

  return [...shows].sort((a, b) => {
    const score = (show: ShowDetails) => {
      const title = normalizeSearchText(show.title || show.name || "");
      let value = 0;

      if (title === normalizedQuery) value += 120;
      if (title.startsWith(normalizedQuery)) value += 80;
      if (title.includes(normalizedQuery)) value += 50;

      value += (show.rating?.average || 0) * 4;
      value += Number.isFinite(show.runtime || 0) ? Math.min(show.runtime || 0, 60) * 0.15 : 0;

      return value;
    };

    return score(b) - score(a);
  });
}

function mapTMDBShow(result: TMDBTVSearchResult): ShowDetails {
  const poster = result.poster_path
    ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
    : result.backdrop_path
      ? `https://image.tmdb.org/t/p/w500${result.backdrop_path}`
      : null;

  return {
    id: result.id,
    name: result.name,
    title: result.name,
    image: poster ? { medium: poster, original: poster } : undefined,
    summary: result.overview || "",
    premiered: result.first_air_date,
    runtime: result.episode_run_time?.[0],
    rating: typeof result.vote_average === "number" ? { average: result.vote_average } : undefined,
    genres: [],
    status: result.status,
    network: result.networks?.[0]?.name ? { name: result.networks[0].name } : undefined,
    type: "tv" as const,
    poster_url: poster || undefined,
    poster_path: poster || undefined,
    overview: result.overview || "",
    release_date: result.first_air_date,
    language: result.original_language || "en",
  };
}

function mapTMDBShowDetails(show: TMDBTVDetails): ShowDetails {
  const poster = show.poster_path
    ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
    : show.backdrop_path
      ? `https://image.tmdb.org/t/p/w500${show.backdrop_path}`
      : null;

  return {
    id: show.id,
    name: show.name,
    title: show.name,
    image: poster ? { medium: poster, original: poster } : undefined,
    summary: show.overview || "",
    premiered: show.first_air_date,
    runtime: show.episode_run_time?.[0],
    rating: typeof show.vote_average === "number" ? { average: show.vote_average } : undefined,
    genres: show.genres?.map((genre) => genre.name) || [],
    status: show.status,
    network: show.networks?.[0]?.name ? { name: show.networks[0].name } : undefined,
    type: "tv" as const,
    poster_url: poster || undefined,
    poster_path: poster || undefined,
    overview: show.overview || "",
    release_date: show.first_air_date,
    language: show.original_language || "en",
  };
}

function mapTVMazeCastCredit(credit: TVMazeCastCredit) {
  if (!credit?.person?.id || !credit.person.name) return null;
  return {
    id: credit.person.id,
    name: credit.person.name,
    profile_url: credit.person.image?.original || credit.person.image?.medium || null,
    character: credit.character?.name || null,
  };
}

function mapTVMazeCrewCredit(credit: TVMazeCrewCredit) {
  if (!credit?.person?.id || !credit.person.name) return null;
  return {
    id: credit.person.id,
    name: credit.person.name,
    profile_url: credit.person.image?.original || credit.person.image?.medium || null,
    job: credit.type || null,
    department: credit.type || null,
  };
}

export async function searchShows(query: string): Promise<ShowDetails[]> {
  try {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const cacheKey = getShowSearchCacheKey(trimmedQuery);
    const cachedEntry = readBrowserCacheEntry<ShowDetails[]>(cacheKey);
    if (cachedEntry) {
      const cached = cachedEntry.value ?? [];
      if (!showSearchRefreshInFlight.has(cacheKey)) {
        const refreshPromise = (async () => {
          const response = await fetch(
            `${TVMAZE_BASE_URL}/search/shows?q=${encodeURIComponent(trimmedQuery)}`
          );

          if (!response.ok) {
            throw new Error("TVMaze search failed");
          }

          const data = await response.json();
          const tvmazeShows = data.map((result: any) => {
            const show = result.show;
            return {
              id: show.id,
              name: show.name,
              title: show.name,
              image: show.image,
              summary: show.summary?.replace(/<[^>]*>/g, "") || "",
              premiered: show.premiered,
              runtime: show.runtime,
              rating: show.rating,
              genres: show.genres || [],
              status: show.status,
              network: show.network,
              type: "tv" as const,
              poster_url: show.image?.original || show.image?.medium,
              poster_path: show.image?.original || show.image?.medium,
              overview: show.summary?.replace(/<[^>]*>/g, "") || "",
              release_date: show.premiered,
            };
          });

          const shouldUseFallback = trimmedQuery.length <= 2 || tvmazeShows.length < 5;
          if (!shouldUseFallback) {
            return rankShows(dedupeShows(tvmazeShows), trimmedQuery);
          }

          const tmdbResponse = await fetchTmdb("search/tv", {
            query: trimmedQuery,
            page: 1,
          });

          if (!tmdbResponse.ok) {
            return rankShows(dedupeShows(tvmazeShows), trimmedQuery);
          }

          const tmdbData: TMDBTVSearchResponse = await tmdbResponse.json();
          const tmdbShows = (tmdbData.results || []).map(mapTMDBShow);

          return rankShows(dedupeShows([...tvmazeShows, ...tmdbShows]), trimmedQuery);
        })()
          .then((fresh) => {
            writeBrowserCache(cacheKey, fresh, SEARCH_CACHE_TTL_MS);
            return fresh;
          })
          .catch((error) => {
            console.error("TVMaze search refresh error:", error);
            return cached;
          })
          .finally(() => {
            showSearchRefreshInFlight.delete(cacheKey);
          });

        showSearchRefreshInFlight.set(cacheKey, refreshPromise);
      }

      return cached;
    }

    const response = await fetch(
      `${TVMAZE_BASE_URL}/search/shows?q=${encodeURIComponent(trimmedQuery)}`
    );

    if (!response.ok) {
      throw new Error("TVMaze search failed");
    }

    const data = await response.json();
    const tvmazeShows = data.map((result: any) => {
      const show = result.show;
      return {
        id: show.id,
        name: show.name,
        title: show.name,
        image: show.image,
        summary: show.summary?.replace(/<[^>]*>/g, "") || "",
        premiered: show.premiered,
        runtime: show.runtime,
        rating: show.rating,
        genres: show.genres || [],
        status: show.status,
        network: show.network,
        type: "tv" as const,
        poster_url: show.image?.original || show.image?.medium,
        poster_path: show.image?.original || show.image?.medium,
        overview: show.summary?.replace(/<[^>]*>/g, "") || "",
        release_date: show.premiered,
      };
    });

    const shouldUseFallback = trimmedQuery.length <= 2 || tvmazeShows.length < 5;
    if (!shouldUseFallback) {
      const results = rankShows(dedupeShows(tvmazeShows), trimmedQuery);
      writeBrowserCache(cacheKey, results, SEARCH_CACHE_TTL_MS);
      return results;
    }

    const tmdbResponse = await fetchTmdb("search/tv", {
      query: trimmedQuery,
      page: 1,
    });

    if (!tmdbResponse.ok) {
      const ranked = rankShows(dedupeShows(tvmazeShows), trimmedQuery);
      writeBrowserCache(cacheKey, ranked, SEARCH_CACHE_TTL_MS);
      return ranked;
    }

    const tmdbData: TMDBTVSearchResponse = await tmdbResponse.json();
    const tmdbShows = (tmdbData.results || []).map(mapTMDBShow);

    const results = rankShows(dedupeShows([...tvmazeShows, ...tmdbShows]), trimmedQuery);
    writeBrowserCache(cacheKey, results, SEARCH_CACHE_TTL_MS);
    return results;
  } catch (error) {
    console.error("Error searching shows:", error);
    return [];
  }
}

export async function getShowDetails(showId: number): Promise<ShowDetails | null> {
  try {
    if (showId >= LIKELY_TMDB_TV_ID_THRESHOLD) {
      const tmdbResponse = await fetchTmdb(`tv/${showId}`);
      if (!tmdbResponse.ok) return null;

      const tmdbData: TMDBTVDetails = await tmdbResponse.json();
      return mapTMDBShowDetails(tmdbData);
    }

    const response = await fetch(`${TVMAZE_BASE_URL}/shows/${showId}`);

    if (!response.ok) {
      const fallbackResponse = await fetchTmdb(`tv/${showId}`);
      if (!fallbackResponse.ok) {
        return null;
      }

      const fallbackData: TMDBTVDetails = await fallbackResponse.json();
      return mapTMDBShowDetails(fallbackData);
    }

    const show = await response.json();
    const [castResult, crewResult] = await Promise.allSettled([
      fetch(`${TVMAZE_BASE_URL}/shows/${showId}/cast`),
      fetch(`${TVMAZE_BASE_URL}/shows/${showId}/crew`),
    ]);

    const castDetails: TVMazeMappedCreditPerson[] = [];
    if (castResult.status === "fulfilled" && castResult.value.ok) {
      const castCredits = (await castResult.value.json()) as TVMazeCastCredit[];
      for (const credit of castCredits) {
        const mapped = mapTVMazeCastCredit(credit);
        if (mapped) castDetails.push(mapped);
      }
    }

    const crewDetails: TVMazeMappedCreditPerson[] = [];
    if (crewResult.status === "fulfilled" && crewResult.value.ok) {
      const crewCredits = (await crewResult.value.json()) as TVMazeCrewCredit[];
      for (const credit of crewCredits) {
        const mapped = mapTVMazeCrewCredit(credit);
        if (mapped) crewDetails.push(mapped);
      }
    }

    return {
      id: show.id,
      name: show.name,
      title: show.name,
      image: show.image,
      summary: show.summary?.replace(/<[^>]*>/g, "") || "",
      premiered: show.premiered,
      runtime: show.runtime,
      rating: show.rating,
      genres: show.genres || [],
      status: show.status,
      network: show.network,
      type: "tv" as const,
      poster_url: show.image?.original || show.image?.medium,
      poster_path: show.image?.original || show.image?.medium,
      overview: show.summary?.replace(/<[^>]*>/g, "") || "",
      release_date: show.premiered,
      language: show.language || "en",
      cast_details: castDetails,
      crew_details: crewDetails,
    };
  } catch {
    try {
      const fallbackResponse = await fetchTmdb(`tv/${showId}`);
      if (!fallbackResponse.ok) return null;

      const fallbackData: TMDBTVDetails = await fallbackResponse.json();
      return mapTMDBShowDetails(fallbackData);
    } catch {
      return null;
    }
  }
}
