import { fetchTmdb } from "./tmdb-transport";

const TVMAZE_BASE_URL = "https://api.tvmaze.com";
const LIKELY_TMDB_TV_ID_THRESHOLD = 100000;

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

export interface ShowDetails extends TVMazeShow {
  type: "tv";
  title?: string;
  poster_url?: string;
  poster_path?: string;
  overview?: string;
  release_date?: string;
  language?: string;
}

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

export async function searchShows(query: string): Promise<ShowDetails[]> {
  try {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

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
