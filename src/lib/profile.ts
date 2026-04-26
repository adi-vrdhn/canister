import { db } from "@/lib/firebase";
import { ref, get, set } from "firebase/database";
import { User, MovieLog, Content } from "@/types";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) return null;

    const userData = snapshot.val();
    return {
      id: userData.id || userId,
      username: userData.username || "",
      name: userData.name || "",
      email: userData.email || undefined,
      avatar_url: userData.avatar_url || null,
      avatar_scale: typeof userData.avatar_scale === "number" ? userData.avatar_scale : 1,
      created_at: userData.createdAt || new Date().toISOString(),
      bio: userData.bio || "",
      display_list_id: userData.display_list_id || undefined,
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const normalizedUsername = username.trim().replace(/^@/, "").toLowerCase();
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) return null;

    const users = snapshot.val();
    const user = Object.values(users as Record<string, any>).find((u: any) => {
      const storedUsername = String(u?.username || "").trim().replace(/^@/, "").toLowerCase();
      const storedId = String(u?.id || u?.user_id || "").trim().toLowerCase();

      return storedUsername === normalizedUsername || storedId === normalizedUsername;
    });

    if (!user) return null;

    const userData = user as any;
    return {
      id: userData.id || userData.user_id,
      username: userData.username,
      name: userData.name,
      email: userData.email || undefined,
      avatar_url: userData.avatar_url || null,
      avatar_scale: typeof userData.avatar_scale === "number" ? userData.avatar_scale : 1,
      created_at: userData.created_at || userData.createdAt || new Date().toISOString(),
      bio: userData.bio || "",
      display_list_id: userData.display_list_id || undefined,
      mood_tags: userData.mood_tags || [],
      mood_tags_updated_at: userData.mood_tags_updated_at,
    };
  } catch (error) {
    console.error("Error fetching user by username:", error);
    return null;
  }
}

/**
 * Get user stats
 */
export async function getUserStats(userId: string): Promise<{
  totalLogged: number;
  masterpieceCount: number;
  goodCount: number;
  badCount: number;
  averageRating: number;
  mostCommonMood?: string;
  totalFriends: number;
}> {
  try {
    // Get logs
    const logsRef = ref(db, "movie_logs");
    const logsSnapshot = await get(logsRef);

    let totalLogged = 0;
    let masterpieceCount = 0;
    let goodCount = 0;
    let badCount = 0;
    const moodCounts: Record<string, number> = {};
    let ratingTotal = 0;

    if (logsSnapshot.exists()) {
      const allLogs = logsSnapshot.val();
      const userLogs = Object.values(allLogs).filter((log: any) => log.user_id === userId);
      
      totalLogged = userLogs.length;
      
      userLogs.forEach((log: any) => {
        if (log.reaction === 2) masterpieceCount++;
        else if (log.reaction === 1) goodCount++;
        else if (log.reaction === 0) badCount++;

        const ratingValue = Number(log.rating);
        if (Number.isFinite(ratingValue) && ratingValue > 0) {
          ratingTotal += ratingValue;
        }
        
        if (log.mood) {
          moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
        }
      });
    }

    // Get most common mood
    const mostCommonMood = Object.entries(moodCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

    // Get friends count (followers + following)
    const followsRef = ref(db, "follows");
    const followsSnapshot = await get(followsRef);

    let totalFriends = 0;
    if (followsSnapshot.exists()) {
      const allFollows = followsSnapshot.val();
      const userFollows = Object.values(allFollows).filter(
        (follow: any) => (follow.follower_id === userId || follow.following_id === userId) && follow.status === "accepted"
      );
      totalFriends = userFollows.length;
    }

    return {
      totalLogged,
      masterpieceCount,
      goodCount,
      badCount,
      averageRating: totalLogged > 0 ? ratingTotal / totalLogged : 0,
      mostCommonMood,
      totalFriends,
    };
  } catch (error) {
    console.error("Error calculating user stats:", error);
    return {
      totalLogged: 0,
      masterpieceCount: 0,
      goodCount: 0,
      badCount: 0,
      averageRating: 0,
      totalFriends: 0,
    };
  }
}

/**
 * Get follower count
 */
export async function getFollowerCount(userId: string): Promise<number> {
  try {
    const followsRef = ref(db, "follows");
    const snapshot = await get(followsRef);

    if (!snapshot.exists()) return 0;

    const allFollows = snapshot.val();
    const followers = Object.values(allFollows).filter(
      (follow: any) => follow.following_id === userId && follow.status === "accepted"
    );

    return followers.length;
  } catch (error) {
    console.error("Error fetching follower count:", error);
    return 0;
  }
}

/**
 * Get following count
 */
export async function getFollowingCount(userId: string): Promise<number> {
  try {
    const followsRef = ref(db, "follows");
    const snapshot = await get(followsRef);

    if (!snapshot.exists()) return 0;

    const allFollows = snapshot.val();
    const following = Object.values(allFollows).filter(
      (follow: any) => follow.follower_id === userId && follow.status === "accepted"
    );

    return following.length;
  } catch (error) {
    console.error("Error fetching following count:", error);
    return 0;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    name?: string;
    bio?: string;
    avatar_url?: string;
    avatar_scale?: number;
    username?: string;
    email?: string;
    mood_tags?: string[];
    display_list_id?: string | null;
  }
): Promise<void> {
  try {
    if (typeof updates.username === "string" && updates.username.trim()) {
      const requestedUsername = updates.username.trim().toLowerCase();
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      const users = usersSnapshot.val() || {};

      const usernameTaken = Object.values(users).some((entry: any) => {
        const entryId = entry?.id;
        const entryUsername = (entry?.username || "").toLowerCase();
        return entryId !== userId && entryUsername === requestedUsername;
      });

      if (usernameTaken) {
        throw new Error("Username already taken");
      }

      updates.username = requestedUsername;
    }

    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      throw new Error("User not found");
    }

    const currentUser = snapshot.val();
    const updateObj: any = {
      ...currentUser,
      ...updates,
    };

    // If mood_tags are being updated, also set the timestamp
    if (updates.mood_tags) {
      updateObj.mood_tags_updated_at = new Date().toISOString();
    }

    await set(userRef, updateObj);
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
}

/**
 * Get recently watched movies (last N movies)
 */
export async function getRecentlyWatchedMovies(userId: string, limit: number = 5): Promise<any[]> {
  try {
    const logsRef = ref(db, "movie_logs");
    const logsSnapshot = await get(logsRef);

    if (!logsSnapshot.exists()) return [];

    const allLogs = logsSnapshot.val();
    const userLogs = Object.values(allLogs)
      .filter((log: any) => log.user_id === userId)
      .sort((a: any, b: any) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime())
      .slice(0, limit);

    // Fetch content details
    const recentMovies = await Promise.all(
      userLogs.map(async (log: any) => {
        try {
          let content: Content;
          if (log.content_type === "tv") {
            const show = await getShowDetails(log.content_id);
            content = show as unknown as Content;
          } else {
            const movie = await getMovieDetails(log.content_id);
            content = movie as unknown as Content;
          }
          return { ...log, content };
        } catch {
          return { ...log, content: null };
        }
      })
    );

    return recentMovies.filter((m) => m.content);
  } catch (error) {
    console.error("Error fetching recently watched movies:", error);
    return [];
  }
}

/**
 * Get most watched genres with reaction weighting
 * Reaction: 2=+2, 1=+1, 0=-1
 */
export async function getMostWatchedGenres(
  userId: string,
  limit: number = 5
): Promise<Array<{ genre: string; count: number; percentage: number }>> {
  try {
    const logsRef = ref(db, "movie_logs");
    const logsSnapshot = await get(logsRef);

    if (!logsSnapshot.exists()) return [];

    const allLogs = logsSnapshot.val();
    const userLogs = Object.values(allLogs).filter((log: any) => log.user_id === userId);

    const genreCounts: Record<string, number> = {};
    const genreWeights: Record<string, number> = {};

    // Fetch movie details to get genres
    await Promise.all(
      userLogs.map(async (log: any) => {
        try {
          let content: Content;
          if (log.content_type === "tv") {
            const show = await getShowDetails(log.content_id);
            content = show as unknown as Content;
          } else {
            const movie = await getMovieDetails(log.content_id);
            content = movie as unknown as Content;
          }

          if (content && content.genres) {
            // Weight by reaction: 2=masterpiece (+2), 1=good (+1), 0=bad (-1)
            const weight = log.reaction === 2 ? 2 : log.reaction === 1 ? 1 : -1;

            content.genres.forEach((genre: string) => {
              genreCounts[genre] = (genreCounts[genre] || 0) + 1;
              genreWeights[genre] = (genreWeights[genre] || 0) + weight;
            });
          }
        } catch {
          // Silently skip if error fetching movie details
        }
      })
    );

    // Sort by weight then by count
    const sorted = Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count, weight: genreWeights[genre] || 0 }))
      .sort((a, b) => (b.weight !== a.weight ? b.weight - a.weight : b.count - a.count))
      .slice(0, limit)
      .map(({ genre, count, weight }) => ({
        genre,
        count,
        percentage: Math.round((count / userLogs.length) * 100),
      }));

    return sorted;
  } catch (error) {
    console.error("Error calculating genres:", error);
    return [];
  }
}

/**
 * Generate mood tags from top genres of last 5 watched movies
 */
export async function generateMoodTags(userId: string): Promise<string[]> {
  try {
    const recentMovies = await getRecentlyWatchedMovies(userId, 5);

    if (recentMovies.length === 0) return [];

    const genreCounts: Record<string, number> = {};

    recentMovies.forEach((movie: any) => {
      if (movie.content?.genres) {
        movie.content.genres.forEach((genre: string) => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      }
    });

    // Get top 3 genres
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    return topGenres;
  } catch (error) {
    console.error("Error generating mood tags:", error);
    return [];
  }
}

/**
 * Update mood tags for user
 */
export async function updateMoodTags(userId: string): Promise<string[]> {
  try {
    const moodTags = await generateMoodTags(userId);
    await updateUserProfile(userId, { mood_tags: moodTags });
    return moodTags;
  } catch (error) {
    console.error("Error updating mood tags:", error);
    return [];
  }
}

/**
 * Calculate movie personality card
 */
export async function getPersonalityCard(userId: string): Promise<{
  title: string;
  loves: string[];
  avoids: string[];
  vibeHollywood: number;
  vibeBollywood: number;
}> {
  try {
    // Get recently watched movies
    const logsRef = ref(db, "movie_logs");
    const logsSnapshot = await get(logsRef);

    if (!logsSnapshot.exists()) {
      return { title: "Movie Explorer", loves: [], avoids: [], vibeHollywood: 50, vibeBollywood: 50 };
    }

    const allLogs = logsSnapshot.val();
    const userLogs = Object.values(allLogs)
      .filter((log: any) => log.user_id === userId)
      .slice(0, 30);

    const genreWeights: Record<string, number> = {};
    const languages: Record<string, number> = {};

    // Analyze movies
    await Promise.all(
      userLogs.map(async (log: any) => {
        try {
          let content: Content;
          if (log.content_type === "tv") {
            const show = await getShowDetails(log.content_id);
            content = show as unknown as Content;
          } else {
            const movie = await getMovieDetails(log.content_id);
            content = movie as unknown as Content;
          }

          if (content) {
            // Weight genres by reaction: 2=masterpiece (+2), 1=good (+1), 0=bad (-1)
            const weight = log.reaction === 2 ? 2 : log.reaction === 1 ? 1 : -1;
            if (content.genres) {
              content.genres.forEach((g: string) => {
                genreWeights[g] = (genreWeights[g] || 0) + weight;
              });
            }

            // Track language (basic heuristic)
            // This is simplified - in real case you'd have language field
            if (content.title && log.content_type === "movie") {
              languages["Hollywood"] = (languages["Hollywood"] || 0) + 1;
            } else if (log.content_type === "tv") {
              languages["Hollywood"] = (languages["Hollywood"] || 0) + 1;
            }
          }
        } catch {
          // Skip errors
        }
      })
    );

    // Determine personality based on top genres
    const topGenres = Object.entries(genreWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([g]) => g);

    const bottmedGenres = Object.entries(genreWeights)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .map(([g]) => g);

    // Generate title based on top genres
    const titleMap: Record<string, string> = {
      "Thriller": "Thriller Strategist",
      "Drama": "Character-Driven Analyst",
      "Action": "Adventure Seeker",
      "Comedy": "Comedy Connoisseur",
      "Sci-Fi": "Sci-Fi Explorer",
      "Horror": "Thrill Junkie",
      "Romance": "Romantic Idealist",
    };

    const title = topGenres.length > 0 
      ? titleMap[topGenres[0]] || `${topGenres[0]} Enthusiast`
      : "Movie Explorer";

    return {
      title,
      loves: topGenres,
      avoids: bottmedGenres,
      vibeHollywood: 60,
      vibeBollywood: 40,
    };
  } catch (error) {
    console.error("Error calculating personality:", error);
    return {
      title: "Movie Explorer",
      loves: [],
      avoids: [],
      vibeHollywood: 50,
      vibeBollywood: 50,
    };
  }
}

/**
 * Calculate achievements/badges
 */
export async function calculateAchievements(userId: string): Promise<string[]> {
  try {
    const logsRef = ref(db, "movie_logs");
    const logsSnapshot = await get(logsRef);
    const achievements: string[] = [];

    if (!logsSnapshot.exists()) return achievements;

    const allLogs = logsSnapshot.val();
    const userLogs = Object.values(allLogs).filter((log: any) => log.user_id === userId);
    const totalWatched = userLogs.length;

    // Badge 1: 100 Movies Club
    if (totalWatched >= 100) {
      achievements.push("100 Movies Club");
    }

    // Badge 2: 50 Films Watched
    if (totalWatched >= 50) {
      achievements.push("50 Films Watched");
    }

    // Badge 3: Genre specialist (80% same genre)
    const genreCounts: Record<string, number> = {};
    await Promise.all(
      userLogs.slice(0, 30).map(async (log: any) => {
        try {
          let content: Content;
          if (log.content_type === "tv") {
            const show = await getShowDetails(log.content_id);
            content = show as unknown as Content;
          } else {
            const movie = await getMovieDetails(log.content_id);
            content = movie as unknown as Content;
          }

          if (content?.genres) {
            content.genres.forEach((g: string) => {
              genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
          }
        } catch {
          // Skip
        }
      })
    );

    const maxGenreCount = Math.max(...Object.values(genreCounts), 0);
    if (maxGenreCount > 0 && maxGenreCount / userLogs.slice(0, 30).length >= 0.8) {
      achievements.push("Genre Specialist");
    }

    // Badge 4: Weekend Binger (10 movies in a week)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekLogs = userLogs.filter((log: any) => new Date(log.watched_at) > oneWeekAgo);
    if (weekLogs.length >= 10) {
      achievements.push("Weekend Binger");
    }

    // Badge 5: Masterpiece Collector (has marked 10+ as masterpiece)
    const masterpieceLogs = userLogs.filter((log: any) => log.reaction === 2).length;
    if (masterpieceLogs >= 10) {
      achievements.push("Masterpiece Collector");
    }

    return achievements;
  } catch (error) {
    console.error("Error calculating achievements:", error);
    return [];
  }
}

/**
 * Get public lists for a user
 */
export async function getPublicListsForUser(userId: string): Promise<any[]> {
  try {
    const listsRef = ref(db, "lists");
    const listsSnapshot = await get(listsRef);

    if (!listsSnapshot.exists()) return [];

    const allLists = listsSnapshot.val();
    const publicLists = Object.values(allLists)
      .filter((list: any) => list.owner_id === userId && list.privacy === "public")
      .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return publicLists as any[];
  } catch (error) {
    console.error("Error fetching public lists:", error);
    return [];
  }
}
