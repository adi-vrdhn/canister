import { fetchTmdb } from "./tmdb-transport";

// Fetch all seasons for a TV show from TVMaze, with TMDB fallback.
// https://www.tvmaze.com/api#show-seasons

export interface TVMazeSeason {
  id: number;
  number: number;
  name: string;
  episodeOrder?: number;
  premiereDate?: string;
  endDate?: string;
  image?: {
    medium?: string;
    original?: string;
  };
  source?: "tvmaze" | "tmdb";
  showId?: number;
}

type TVMazeSeasonApi = {
  id: number;
  number: number;
  name?: string;
  episodeOrder?: number;
  premiereDate?: string;
  endDate?: string;
  image?: {
    medium?: string;
    original?: string;
  };
};

export interface TVMazeEpisode {
  id: number;
  name: string;
  season: number;
  number: number;
  airdate?: string;
  airtime?: string;
  runtime?: number;
  image?: {
    medium?: string;
    original?: string;
  };
  summary?: string;
}

type TVMazeEpisodeApi = {
  id: number;
  name?: string;
  season: number;
  number: number;
  airdate?: string;
  airtime?: string;
  runtime?: number;
  image?: {
    medium?: string;
    original?: string;
  };
  summary?: string;
};

type TMDBTVSeasonApi = {
  id: number;
  season_number: number;
  name?: string;
  episode_count?: number;
  air_date?: string;
  overview?: string;
  poster_path?: string | null;
};

type TMDBTVSeasonDetailsApi = {
  id: number;
  season_number: number;
  name?: string;
  air_date?: string;
  overview?: string;
  poster_path?: string | null;
  episodes?: Array<{
    id: number;
    name?: string;
    episode_number: number;
    air_date?: string;
    runtime?: number;
    still_path?: string | null;
    overview?: string;
  }>;
};

function mapTMDBSeason(season: TMDBTVSeasonApi, showId: number): TVMazeSeason {
  return {
    id: season.id,
    number: season.season_number,
    name: season.name || `Season ${season.season_number}`,
    premiereDate: season.air_date,
    image: season.poster_path
      ? {
          medium: `https://image.tmdb.org/t/p/w300${season.poster_path}`,
          original: `https://image.tmdb.org/t/p/original${season.poster_path}`,
        }
      : undefined,
    source: "tmdb",
    showId,
  };
}

export async function getShowSeasons(showId: number): Promise<TVMazeSeason[]> {
  try {
    const response = await fetch(`https://api.tvmaze.com/shows/${showId}/seasons`);
    if (response.ok) {
      const data = (await response.json()) as TVMazeSeasonApi[];
      const mapped = data
        .filter((season) => typeof season.number === "number" && season.number > 0)
        .map((season) => ({
          id: season.id,
          number: season.number,
          name: season.name || `Season ${season.number}`,
          episodeOrder: season.episodeOrder,
          premiereDate: season.premiereDate,
          endDate: season.endDate,
          image: season.image,
          source: "tvmaze" as const,
          showId,
        }));

      if (mapped.length > 0) {
        return mapped;
      }
    }

    const tmdbResponse = await fetchTmdb(`tv/${showId}`);
    if (!tmdbResponse.ok) return [];

    const tmdbData = (await tmdbResponse.json()) as { seasons?: TMDBTVSeasonApi[] };
    return (tmdbData.seasons || [])
      .filter((season) => typeof season.season_number === "number" && season.season_number > 0)
      .map((season) => mapTMDBSeason(season, showId));
  } catch {
    try {
      const tmdbResponse = await fetchTmdb(`tv/${showId}`);
      if (!tmdbResponse.ok) return [];

      const tmdbData = (await tmdbResponse.json()) as { seasons?: TMDBTVSeasonApi[] };
      return (tmdbData.seasons || [])
        .filter((season) => typeof season.season_number === "number" && season.season_number > 0)
        .map((season) => mapTMDBSeason(season, showId));
    } catch {
      return [];
    }
  }
}

export async function getSeasonEpisodes(season: TVMazeSeason): Promise<TVMazeEpisode[]> {
  try {
    if (season.source !== "tmdb") {
      const response = await fetch(`https://api.tvmaze.com/seasons/${season.id}/episodes`);
      if (response.ok) {
        const data = (await response.json()) as TVMazeEpisodeApi[];
        if (data.length > 0) {
          return data.map((episode) => ({
            id: episode.id,
            name: episode.name || "Untitled",
            season: episode.season,
            number: episode.number,
            airdate: episode.airdate,
            airtime: episode.airtime,
            runtime: episode.runtime,
            image: episode.image,
            summary: episode.summary,
          }));
        }
      }
    }

    if (!season.showId || typeof season.number !== "number") return [];

    const tmdbResponse = await fetchTmdb(`tv/${season.showId}/season/${season.number}`);
    if (!tmdbResponse.ok) return [];

    const tmdbSeason = (await tmdbResponse.json()) as TMDBTVSeasonDetailsApi;
    return (tmdbSeason.episodes || []).map((episode) => ({
      id: episode.id,
      name: episode.name || "Untitled",
      season: tmdbSeason.season_number || season.number,
      number: episode.episode_number,
      airdate: episode.air_date,
      airtime: undefined,
      runtime: episode.runtime,
      image: episode.still_path
        ? {
            medium: `https://image.tmdb.org/t/p/w300${episode.still_path}`,
            original: `https://image.tmdb.org/t/p/original${episode.still_path}`,
          }
        : undefined,
      summary: episode.overview,
    }));
  } catch {
    return [];
  }
}
