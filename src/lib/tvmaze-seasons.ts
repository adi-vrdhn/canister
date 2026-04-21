// Fetch all seasons for a TV show from TVMaze
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
}

export async function getShowSeasons(showId: number): Promise<TVMazeSeason[]> {
  try {
    const response = await fetch(`https://api.tvmaze.com/shows/${showId}/seasons`);
    if (!response.ok) throw new Error("Failed to fetch seasons");
    const data = await response.json();
    return data.map((season: any) => ({
      id: season.id,
      number: season.number,
      name: season.name || `Season ${season.number}`,
      episodeOrder: season.episodeOrder,
      premiereDate: season.premiereDate,
      endDate: season.endDate,
      image: season.image,
    }));
  } catch (e) {
    console.error("Error fetching seasons:", e);
    return [];
  }
}
