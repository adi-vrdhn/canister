"use client";

import { useEffect, useState } from "react";
import CinePostPreviewList from "@/components/CinePostPreviewList";
import { CinePostWithDetails, User } from "@/types";
import { getUserCinePosts, getUserEngagedCinePosts } from "@/lib/cineposts";

export default function ProfileCinePostsPanel({
  mode,
  profileUserId,
  currentUser,
}: {
  mode: "posts" | "saved" | "liked";
  profileUserId: string;
  currentUser: User | null;
}) {
  const [posts, setPosts] = useState<CinePostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      try {
        const results =
          mode === "posts"
            ? await getUserCinePosts(profileUserId, currentUser?.id, 40)
            : await getUserEngagedCinePosts(
                profileUserId,
                mode === "saved" ? "save" : "like",
                currentUser?.id,
                40
              );

        if (!cancelled) setPosts(results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    loadPosts();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, mode, profileUserId, refreshTick]);

  const title = mode === "posts" ? "Posts" : mode === "saved" ? "Saved Posts" : "Liked Posts";
  const empty =
    mode === "posts"
      ? "No posts yet."
      : mode === "saved"
        ? "No saved posts yet."
        : "No liked posts yet.";

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-lg font-black text-[#f5f0de]">{title}</h2>
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse border-b border-white/10 bg-white/5" />
          ))}
        </div>
      ) : (
        <CinePostPreviewList
          posts={posts}
          emptyText={empty}
          currentUser={currentUser}
          onPostMutated={() => setRefreshTick((value) => value + 1)}
        />
      )}
    </section>
  );
}
