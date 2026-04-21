/**
 * AI-Powered Movie Recommendation Chatbot
 * Uses Google Generative AI (Gemini) API - FREE tier
 * No credit card required for free tier
 */

import { ChatRecommendation } from "./chat-types";
import { searchMovies } from "./tmdb";
import { TMDBMovie } from "@/types";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export interface AIResponse {
  message: string;
  recommendations: ChatRecommendation[];
  searchQuery: string;
}

/**
 * Chat with AI and get movie recommendations
 */
export async function chatWithAI(userMessage: string): Promise<AIResponse> {
  try {
    console.log("[AI Chatbot] User message:", userMessage);
    console.log("[AI Chatbot] API Key available:", !!GEMINI_API_KEY);
    console.log("[AI Chatbot] API Key:", GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 10)}...` : "NOT SET");

    if (!GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY not found! Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env.local file"
      );
    }

    // Step 1: Get AI to extract movie preferences and generate search query
    const extractionPrompt = `You are a helpful movie recommendation assistant. 
    
The user just said: "${userMessage}"

Analyze their message and:
1. Extract what mood/emotion they're in
2. Extract what type of movies they want (genre, era, style)
3. Generate a SEARCH QUERY that can be used to find movies on TMDB API

Respond in JSON format ONLY (no markdown, no extra text):
{
  "mood": "their mood/emotion or null",
  "genres": "comma-separated genres like 'comedy, drama, action'",
  "era": "year ranges like '2020-2023' or null for any year",
  "searchQuery": "a good search query like 'Forrest Gump' or 'heartwarming comedies'",
  "reasoning": "brief explanation of what they want"
}`;

    const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    console.log("[AI Chatbot] Calling Gemini API:", apiUrl.substring(0, 60) + "...");

    const extractionResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: extractionPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!extractionResponse.ok) {
      const errorText = await extractionResponse.text();
      console.error("[AI Chatbot] Gemini API Error Response:", {
        status: extractionResponse.status,
        statusText: extractionResponse.statusText,
        body: errorText,
      });
      throw new Error(`Gemini API failed: ${extractionResponse.status} - ${errorText}`);
    }

    const extractionData = await extractionResponse.json();
    const extractedText =
      extractionData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("[AI Chatbot] Extracted preference:", extractedText);

    let extraction;
    try {
      // Clean up potential markdown formatting
      const cleanedText = extractedText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      extraction = JSON.parse(cleanedText);
    } catch (e) {
      console.error("[AI Chatbot] Failed to parse extraction:", e);
      extraction = {
        mood: null,
        genres: "",
        era: null,
        searchQuery: userMessage,
        reasoning: "Fallback to user message",
      };
    }

    const searchQuery = extraction.searchQuery || userMessage;
    console.log("[AI Chatbot] Search query:", searchQuery);

    // Step 2: Search for movies using the query
    const movieResults = await searchMovies(searchQuery, 1);
    console.log("[AI Chatbot] Found", movieResults.length, "movies");

    // Map to recommendations
    const recommendations: ChatRecommendation[] = movieResults
      .slice(0, 8)
      .map((movie: TMDBMovie) => ({
        id: movie.id,
        title: movie.title,
        poster_url: movie.poster_path
          ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
          : null,
        rating: movie.vote_average,
        genres: [],
        type: "movie" as const,
        release_date: movie.release_date,
      }));

    // Step 3: Generate a friendly response message
    const responsePrompt = `You are a friendly movie recommendation assistant.

The user said: "${userMessage}"

Here are movie recommendations I found for them:
${recommendations.map((r) => `- "${r.title}" (${r.release_date?.substring(0, 4)}, Rating: ${r.rating}/10)`).join("\n")}

Generate a warm, conversational response (2-3 sentences max) acknowledging their request and introducing the recommendations. Be enthusiastic and personal!`;

    const responseApiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    const responseData = await fetch(responseApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: responsePrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 200,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!responseData.ok) {
      const responseErrorText = await responseData.text();
      console.error("[AI Chatbot] Response Generation Error:", {
        status: responseData.status,
        body: responseErrorText,
      });
      throw new Error(`Failed to generate response: ${responseData.status}`);
    }

    const responseContent = await responseData.json();
    const message =
      responseContent.candidates?.[0]?.content?.parts?.[0]?.text ||
      `I found ${recommendations.length} great movies for you! Check them out below.`;

    console.log("[AI Chatbot] Generated response:", message);

    return {
      message,
      recommendations,
      searchQuery,
    };
  } catch (error) {
    console.error("[AI Chatbot] Error:", error);
    throw error;
  }
}

/**
 * Start a multi-turn conversation with context
 */
export class MovieChatSession {
  private conversationHistory: Array<{ role: string; message: string }> = [];

  async chat(userMessage: string): Promise<AIResponse> {
    // Add user message to history
    this.conversationHistory.push({
      role: "user",
      message: userMessage,
    });

    try {
      const response = await chatWithAI(userMessage);

      // Add bot response to history (for future context)
      this.conversationHistory.push({
        role: "assistant",
        message: response.message,
      });

      return response;
    } catch (error) {
      console.error("Chat error:", error);
      throw error;
    }
  }

  getHistory() {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}
