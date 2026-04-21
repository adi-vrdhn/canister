/**
 * Chat message types and utilities
 */

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
  recommendations?: ChatRecommendation[];
}

export interface ChatRecommendation {
  id: number;
  title: string;
  poster_url: string | null;
  rating: number | null;
  genres: string[] | null;
  type: "movie" | "tv";
  release_date?: string;
}

/**
 * Create a new user message
 */
export function createUserMessage(content: string): ChatMessage {
  return {
    id: `msg_${Date.now()}_${Math.random()}`,
    role: "user",
    content,
    timestamp: new Date(),
  };
}

/**
 * Create a new bot message
 */
export function createBotMessage(content: string, recommendations?: ChatRecommendation[]): ChatMessage {
  return {
    id: `msg_${Date.now()}_${Math.random()}`,
    role: "bot",
    content,
    timestamp: new Date(),
    recommendations,
  };
}
