/**
 * NLP Parser for movie recommendations
 * Rule-based keyword extraction and intent recognition
 */

export interface ParsedIntent {
  mood: string | null; // "happy", "sad", "excited", "relaxed", "scary", etc.
  genres: string[]; // ["action", "comedy", "drama"]
  minRating: number | null; // 1-10
  maxYear: number | null; // Release year filter
  minYear: number | null; // Oldest acceptable
  director: string | null; // Director name
  cast: string | null; // Actor name
  language: string | null; // "en", "fr", etc.
  keywords: string[]; // Other search keywords
  rawQuery: string;
  confidence: number; // 0-1 confidence score
}

// Mood detection keywords
const MOOD_KEYWORDS: Record<string, string[]> = {
  happy: ["happy", "cheerful", "cheer", "laugh", "funny", "comedy", "uplifting", "positive", "good mood", "fun"],
  sad: ["sad", "depressed", "cry", "emotional", "drama", "tear", "melancholy", "gloomy", "down"],
  excited: ["excited", "thrilled", "action", "adventure", "intense", "adrenaline", "fast-paced", "explosive"],
  relaxed: ["relax", "chill", "calm", "peaceful", "slow", "meditative", "comfort", "cozy", "laid back", "easy"],
  scary: ["scary", "horror", "terrifying", "suspense", "thriller", "creepy", "spooky", "dark"],
  romantic: ["romantic", "love", "romance", "couple", "relationship", "sweet"],
  thoughtful: ["thought", "intelligent", "deep", "philosophical", "meaningful", "inspiring", "motivate"],
};

// Genre keyword mapping
const GENRE_KEYWORDS: Record<string, string[]> = {
  action: ["action", "fight", "battle", "war", "explosion", "chase"],
  comedy: ["comedy", "funny", "laugh", "comic", "humor", "happy", "cheerful", "uplifting"],
  drama: ["drama", "emotional", "serious", "character", "sad", "depressed", "melancholy"],
  horror: ["horror", "scary", "terrifying", "creepy", "supernatural"],
  thriller: ["thriller", "suspense", "mystery", "detective", "crime"],
  adventure: ["adventure", "explore", "quest", "journey", "travel", "excited", "thrilled", "intense"],
  animation: ["animated", "cartoon", "anime", "pixar", "disney"],
  scifi: ["sci-fi", "science fiction", "sci fi", "future", "space", "alien", "robot"],
  fantasy: ["fantasy", "magic", "wizard", "magical", "sword", "quest"],
  romance: ["romance", "romantic", "love", "couple"],
  documentary: ["documentary", "doc", "real story", "true story", "biography"],
  mystery: ["mystery", "puzzle", "detective", "secret"],
};

// Filter keywords
const FILTER_KEYWORDS = {
  rating: /(?:imdb|rating|score)[\s:]*(\d+(?:\.\d+)?)/gi,
  year: /(\d{4})|(?:recent|latest|new|old|classic)/gi,
  language: /(?:english|spanish|french|german|hindi|japanese|korean|chinese|language)[\s:]*(\w+)?/gi,
  minRating: /(?:at least|minimum|above|over)[\s:]*(\d+(?:\.\d+)?)/gi,
};

/**
 * Parse natural language query for movie recommendation intent
 */
export function parseMovieIntent(query: string): ParsedIntent {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  let mood: string | null = null;
  let requestedMood: string | null = null; // The mood for MOVIES to watch
  const genres: string[] = [];
  let minRating: number | null = null;
  let maxYear: number | null = null;
  let minYear: number | null = null;
  let director: string | null = null;
  let cast: string | null = null;
  let language: string | null = null;
  const keywords: string[] = [];
  let confidence = 0.5;

  // Detect mood - look for user's current mood
  for (const [moodName, keywords_list] of Object.entries(MOOD_KEYWORDS)) {
    for (const keyword of keywords_list) {
      if (lowerQuery.includes(keyword)) {
        mood = moodName;
        confidence += 0.2;
        break;
      }
    }
    if (mood) break;
  }

  // Detect requested mood preference for movies
  // Look for patterns like "watch X movies", "suggest X", "want X"
  const moodPatterns = [
    /(?:watch|suggest|recommend|want|looking for|show me)\s+([a-z]+)\s+(?:movie|film)/i,
    /(?:movie|film)\s+(?:that|like|with)\s+([a-z]+)\s+(?:vibe|feel|mood|tone)/i,
  ];

  for (const pattern of moodPatterns) {
    const match = lowerQuery.match(pattern);
    if (match && match[1]) {
      const requestedWord = match[1];
      // Check if it's a mood keyword
      for (const [moodName, keywords_list] of Object.entries(MOOD_KEYWORDS)) {
        if (keywords_list.includes(requestedWord)) {
          requestedMood = moodName;
          break;
        }
      }
      if (requestedMood) break;
    }
  }

  // Use requested mood if found, otherwise use detected mood
  const effectiveMood = requestedMood || mood;

  // Detect genres based on effective mood + explicit genre keywords
  if (effectiveMood) {
    // Map mood to genres
    const moodToGenres: Record<string, string[]> = {
      happy: ["comedy"],
      sad: ["drama"],
      excited: ["action", "adventure"],
      relaxed: ["drama", "romance"],
      scary: ["horror", "thriller"],
      romantic: ["romance"],
      thoughtful: ["drama"],
    };

    if (moodToGenres[effectiveMood]) {
      genres.push(...moodToGenres[effectiveMood]);
    }
  }

  // Also detect explicit genre keywords
  for (const [genreName, keywords_list] of Object.entries(GENRE_KEYWORDS)) {
    for (const keyword of keywords_list) {
      if (lowerQuery.includes(keyword) && !genres.includes(genreName)) {
        genres.push(genreName);
        confidence += 0.1;
      }
    }
  }

  // Extract rating filters
  const ratingMatch = lowerQuery.match(/(?:rating|imdb|score)[\s:]*(\d+(?:\.\d+)?)/i);
  if (ratingMatch) {
    minRating = parseFloat(ratingMatch[1]);
  }

  const minRatingMatch = lowerQuery.match(/(?:at least|minimum|above|over)[\s:]*(\d+(?:\.\d+)?)/i);
  if (minRatingMatch) {
    minRating = parseFloat(minRatingMatch[1]);
  }

  // Extract year filters
  const yearMatches = lowerQuery.match(/\d{4}/g);
  if (yearMatches) {
    const years = yearMatches.map((y) => parseInt(y));
    maxYear = Math.max(...years);
    minYear = Math.min(...years);
  }

  // Detect language
  const langMatch = lowerQuery.match(
    /(?:language|lang|(?:in|with)\s+)(\w+)|english|spanish|french|german|hindi|japanese|korean/i
  );
  if (langMatch) {
    const langMap: Record<string, string> = {
      english: "en",
      spanish: "es",
      french: "fr",
      german: "de",
      hindi: "hi",
      japanese: "ja",
      korean: "ko",
      chinese: "zh",
    };
    language = langMap[langMatch[1]?.toLowerCase() || langMatch[0]?.toLowerCase()] || null;
  }

  // Extract director (simple heuristic: "by [Name]" or "directed by [Name]")
  const directorMatch = lowerQuery.match(/(?:director|by|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (directorMatch) {
    director = directorMatch[1];
  }

  // Extract cast (simple heuristic: "with [Name]" or "starring [Name]")
  const castMatch = lowerQuery.match(/(?:with|starring|actor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (castMatch) {
    cast = castMatch[1];
  }

  // Extract keywords (words not already parsed)
  const parsedWords = new Set([
    ...Object.values(MOOD_KEYWORDS).flat(),
    ...Object.values(GENRE_KEYWORDS).flat(),
    "i", "want", "to", "watch", "movie", "film", "show", "a", "an", "is", "are", "be", "been", "that", "which",
  ]);

  for (const word of words) {
    if (word.length > 2 && !parsedWords.has(word) && !word.match(/\d{4}/)) {
      keywords.push(word);
    }
  }

  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);

  return {
    mood,
    genres: [...new Set(genres)],
    minRating,
    maxYear,
    minYear,
    director,
    cast,
    language,
    keywords,
    rawQuery: query,
    confidence,
  };
}

/**
 * Generate a friendly chat response based on parsed intent
 */
export function generateResponse(intent: ParsedIntent): string {
  const parts: string[] = [];

  if (intent.mood) {
    parts.push(`I love that you want a **${intent.mood}** movie!`);
  } else {
    parts.push("Let me find some great recommendations for you!");
  }

  if (intent.genres.length > 0) {
    parts.push(`You're interested in ${intent.genres.map((g) => `**${g}**`).join(", ")}.`);
  }

  if (intent.minRating) {
    parts.push(`Filtering for highly-rated movies (${intent.minRating}+).`);
  }

  if (intent.director) {
    parts.push(`Checking out works by **${intent.director}**.`);
  }

  if (intent.cast) {
    parts.push(`Looking for films with **${intent.cast}**.`);
  }

  parts.push("Here are my top picks for you:");

  return parts.join(" ");
}

/**
 * Build TMDB filter query from parsed intent
 */
export function buildTMDBFilters(intent: ParsedIntent): Record<string, any> {
  const filters: Record<string, any> = {};

  // Note: This would be used in conjunction with TMDB API
  // These would translate to query parameters for the TMDB search endpoint

  if (intent.genres.length > 0) {
    filters.genres = intent.genres;
  }

  if (intent.minRating) {
    filters.minRating = intent.minRating;
  }

  if (intent.minYear) {
    filters.minYear = intent.minYear;
  }

  if (intent.maxYear) {
    filters.maxYear = intent.maxYear;
  }

  if (intent.language) {
    filters.language = intent.language;
  }

  if (intent.director) {
    filters.director = intent.director;
  }

  if (intent.cast) {
    filters.cast = intent.cast;
  }

  return filters;
}
