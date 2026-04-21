// User Types
export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  avatar_url: string | null;
  created_at: string;
  bio?: string;
  display_list_id?: string;
  mood_tags?: string[]; // Auto-detected mood tags (3-5)
  mood_tags_updated_at?: string; // When mood_tags were last updated
}

// Movie Types
export interface Movie {
  id: number; // TMDB ID
  title: string;
  poster_url: string | null;
  backdrop_url?: string | null;
  genres: string[] | null;
  platforms: string[] | null;
  director: string | null;
  actors?: string[] | null; // For match scoring
  cast?: string[] | null;
  language?: string | null; // For match scoring
  release_date: string | null;
  overview: string | null;
  runtime: number | null;
  rating: number | null;
  created_at: string;
  type?: "movie";
}

// TV Show Types
export interface TVShow {
  id: number; // TVMaze ID
  title: string;
  name?: string;
  poster_url: string | null;
  genres: string[] | null;
  director?: string | null;
  actors?: string[] | null; // For match scoring
  cast?: string[] | null;
  language?: string | null; // For match scoring
  status: string | null;
  country?: string | null;
  release_date: string | null;
  overview: string | null;
  runtime: number | null;
  rating: number | null;
  created_at: string;
  type: "tv";
  network?: {
    name?: string;
  };
  streaming_services?: string[] | null;
}

// Combined content type (movie or TV show)
export type Content = (Movie & { type?: "movie" }) | (TVShow & { type: "tv" });

// Watched Log Types
export interface WatchedLog {
  id: string;
  user_id: string;
  content_id: number;
  content_type: "movie" | "tv";
  watched_at: string;
  notes: string | null;
  seen: boolean;
  watch_later: boolean;
  created_at: string;
}

// Share Types
export interface Share {
  id: string;
  sender_id: string;
  receiver_id: string;
  content_id: string | number; // Can be formatted "movie-123" or numeric 123
  content_type: "movie" | "tv";
  note?: string | null; // Optional message/note
  watched?: boolean; // Whether receiver has marked as watched
  watched_at?: string; // When receiver marked as watched
  created_at: string;
}

// Follow Types
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  status: "pending" | "accepted";
  created_at: string;
}

// Extended types for display
export interface WatchedLogWithContent extends WatchedLog {
  content: Content;
}

export interface ShareWithDetails extends Share {
  movie?: Movie; // For backward compatibility
  content?: Content; // New unified field
  sender?: User;
  receiver?: User;
}

export interface FollowWithUser extends Follow {
  follower: User;
  following: User;
}

// TMDB Types
export interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  genres: number[];
  director: string | null;
  release_date: string;
  overview: string;
  runtime: number;
  vote_average: number;
  popularity?: number;
  vote_count?: number;
}

export interface TMDBSearchResponse {
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

// Reaction Types (for aggregating user reactions)
export interface MovieReaction {
  contentId: number;
  contentType: "movie" | "tv";
  badCount: number; // Reaction = 0
  goodCount: number; // Reaction = 1
  masterpieceCount: number; // Reaction = 2
}

// Review Types
export interface MovieReview {
  id: string;
  user_id: string;
  content_id: number;
  content_type: "movie" | "tv";
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
}

export interface MovieReviewWithUser extends MovieReview {
  user: User;
}

// List Types
export interface List {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  privacy: "private" | "public";
  is_ranked: boolean; // true for ranked list, false for regular list
  view_type: "grid" | "list"; // User's preferred view
  show_unwatched_first: boolean; // Toggle for unwatched at top
  cover_type: "grid" | "custom"; // grid: auto-grid from items, custom: single image
  cover_image_url: string | null; // For custom covers
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  content_id: number;
  content_type: "movie" | "tv";
  added_by_user_id: string;
  position: number; // Order in the list for ranked/regular lists
  added_at: string;
  watched_by: string[]; // Array of user IDs who watched this item
}

export interface ListCollaborator {
  id: string;
  list_id: string;
  user_id: string;
  role: "owner" | "collaborator";
  joined_at: string;
}

// Extended types for display
export interface ListWithItems extends List {
  items: ListItemWithContent[];
  collaborators: ListCollaboratorWithUser[];
  item_count: number;
  collaborator_count: number;
}

export interface ListItemWithContent extends ListItem {
  content: Content;
  added_by_user: User;
}

export interface ListCollaboratorWithUser extends ListCollaborator {
  user: User;
}

// Movie Log Types
export interface MovieLog {
  id: string;
  user_id: string;
  content_id: number;
  content_type: "movie" | "tv";
  watched_date: string; // Date when the movie was watched (YYYY-MM-DD)
  reaction: 0 | 1 | 2; // 0=Bad, 1=Good, 2=Masterpiece
  notes: string; // Review/thoughts
  mood?: string; // How they felt (e.g., "happy", "sad", "excited")
  watch_later?: boolean; // For watchlist - movie to watch later (not watched yet)

  // TV-specific fields (optional)
  season?: number; // Season number (for TV logs)
  episode?: number; // Episode number (if logging by episode in future)

  // Context Log (optional)
  context_log?: {
    location?: string; // Where they watched (e.g., "Cinema", "Home")
    watched_with?: string; // Who they watched with (free text, can include @mentions)
    mood?: string; // Mood during watching
  };

  created_at: string;
  updated_at: string;
}

// Extended type for display
export interface MovieLogWithContent extends MovieLog {
  content: Content;
  user: User;
  tagged_users?: User[]; // Populated user objects for tagged_people
}

// User Taste Types - for building your taste profile
export interface UserTaste {
  id: string;
  user_id: string;
  content_id: number;
  content_type: "movie" | "tv";
  reaction?: 0 | 1 | 2;
  added_at: string;
}

// Extended type for display
export interface UserTasteWithContent extends UserTaste {
  content: Content;
}

// Taste Vector Types - for recommendation engine
export interface TasteVector {
  userId: string;
  genres: Record<string, number>; // {"Thriller": 1.5, "Comedy": -0.5, ...}
  moods: Record<string, number>; // {"Dark": 1, "Feel-good": 0.5, ...}
  directors: Record<string, number>; // {"Nolan": 1, ...}
  lastUpdated: string;
}

export interface MovieVector {
  contentId: number;
  contentType: "movie" | "tv";
  genres: string[];
  moods: string[]; // Inferred moods
  director?: string;
}

export interface TasteMatch {
  userId1: string;
  userId2: string;
  matchPercentage: number; // 0-100
  commonFavorites: number[];
  lastCalculated: string;
}
