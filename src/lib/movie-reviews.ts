import { ref, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { MovieReviewWithUser, User } from "@/types";
import { getUserProfile, getUsersByIds } from "@/lib/users";

function mapReactionToRating(reaction: 0 | 1 | 1.5 | 2 | undefined): 1 | 2 | 3 | 4 | 5 {
  if (reaction === 2) return 5;
  if (reaction === 1) return 4;
  if (reaction === 1.5) return 3;
  return 2;
}

export async function getMovieReviewFeed(
  contentId: number,
  contentType: "movie" | "tv" = "movie"
): Promise<MovieReviewWithUser[]> {
  const userCache = new Map<string, User>();

  const resolveUser = async (userId: string): Promise<User> => {
    const cached = userCache.get(userId);
    if (cached) return cached;

    const resolvedUser = await getUserProfile(userId);

    userCache.set(userId, resolvedUser);
    return resolvedUser;
  };

  const mergedReviews: MovieReviewWithUser[] = [];

  try {
    const reviewsSnapshot = await get(ref(db, "reviews"));
    if (reviewsSnapshot.exists()) {
      const allReviews = reviewsSnapshot.val() || {};
      const tableReviews = Object.entries(allReviews)
        .map(([key, review]: any) => ({ id: key, ...review }))
        .filter(
          (review: any) =>
            Number(review.content_id) === contentId && review.content_type === contentType
        );

      const tableUsers = await getUsersByIds(tableReviews.map((review) => review.user_id));

      for (const review of tableReviews) {
        const resolvedUser = tableUsers[review.user_id] || (await resolveUser(review.user_id));
        mergedReviews.push({
          id: String(review.id),
          user_id: review.user_id,
          content_id: contentId,
          content_type: contentType,
          rating: review.rating,
          text: review.text || "",
          likes_count: review.likes_count || 0,
          created_at: review.created_at || new Date().toISOString(),
          updated_at: review.updated_at || review.created_at || new Date().toISOString(),
          user: resolvedUser,
        });
      }
    }
  } catch (error) {
    console.warn("Skipping legacy reviews table for movie feed:", error);
  }

  try {
    const movieLogsSnapshot = await get(ref(db, "movie_logs"));
    if (movieLogsSnapshot.exists()) {
      const allLogs = movieLogsSnapshot.val() || {};
      const logReviews = Object.entries(allLogs)
        .map(([key, log]: any) => ({ id: key, ...log }))
        .filter((log: any) => {
          if (Number(log.content_id) !== contentId) return false;
          if (log.content_type !== contentType) return false;
          if (typeof log.notes !== "string") return false;
          return log.notes.trim().length > 0;
        });

      const logUsers = await getUsersByIds(logReviews.map((log) => log.user_id));

      for (const logReview of logReviews) {
        const resolvedUser = logUsers[logReview.user_id] || (await resolveUser(logReview.user_id));
        mergedReviews.push({
          id: `log-${logReview.id}`,
          user_id: logReview.user_id,
          content_id: contentId,
          content_type: contentType,
          rating: mapReactionToRating(logReview.reaction),
          text: logReview.notes,
          likes_count: 0,
          created_at: logReview.created_at || new Date().toISOString(),
          updated_at: logReview.updated_at || logReview.created_at || new Date().toISOString(),
          user: resolvedUser,
        });
      }
    }
  } catch (error) {
    console.warn("Skipping movie log reviews for movie feed:", error);
  }

  mergedReviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return mergedReviews;
}
