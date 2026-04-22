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
  }, [currentUser?.id, mode, profileUserId]);

  const title = mode === "posts" ? "Posts" : mode === "saved" ? "Saved Posts" : "Liked Posts";
  const empty =
    mode === "posts"
      ? "No posts yet."
      : mode === "saved"
        ? "No saved posts yet."
        : "No liked posts yet.";

  return (
    <section className="rounded-[2rem] border border-[#d8c8a6]/70 bg-[#f8f4ec] p-4 shadow-[0_18px_45px_rgba(6,9,16,0.25)] sm:p-6">
      <h2 className="mb-4 text-lg font-black text-zinc-900">{title}</h2>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl bg-white/70" />
          ))}
        </div>
      ) : (
        <CinePostPreviewList posts={posts} emptyText={empty} />
      )}
    </section>
  );
}
