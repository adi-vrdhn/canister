import { db } from "@/lib/firebase";
import { ref, get, set, push, remove } from "firebase/database";

// Add a like to a log
export async function likeLog(logId: string, userId: string): Promise<void> {
  const likeRef = ref(db, `log_likes/${logId}/${userId}`);
  await set(likeRef, true);
}

// Remove a like from a log
export async function unlikeLog(logId: string, userId: string): Promise<void> {
  const likeRef = ref(db, `log_likes/${logId}/${userId}`);
  await remove(likeRef);
}

// Get like count and whether the user liked
export async function getLogLikes(logId: string, userId: string): Promise<{ count: number; liked: boolean }> {
  const likesRef = ref(db, `log_likes/${logId}`);
  const snapshot = await get(likesRef);
  if (!snapshot.exists()) return { count: 0, liked: false };
  const likes = snapshot.val();
  const userLiked = !!likes[userId];
  return { count: Object.keys(likes).length, liked: userLiked };
}
