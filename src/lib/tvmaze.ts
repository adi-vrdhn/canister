const TVMAZE_API_KEY = "8jC46lnuAQlcFbodm34yIf-8MstRiTZI";
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

export async function searchShows(query: string): Promise<ShowDetails[]> {
  try {
    const response = await fetch(
      `${TVMAZE_BASE_URL}/search/shows?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error("TVMaze search failed");
    }

    const data = await response.json();

    return data.map((result: any) => {
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
