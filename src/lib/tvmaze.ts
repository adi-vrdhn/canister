import { fetchTmdb } from "./tmdb-transport";

const TVMAZE_BASE_URL = "https://api.tvmaze.com";

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
    const response = await fetch(`${TVMAZE_BASE_URL}/shows/${showId}`);

    if (!response.ok) {
      throw new Error("Show details fetch failed");
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
  } catch (error) {
    console.error("Error fetching show details:", error);
    return null;
  }
}
