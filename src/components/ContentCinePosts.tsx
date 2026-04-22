"use client";

import { useEffect, useState } from "react";
import CinePostPreviewList from "@/components/CinePostPreviewList";
import { CinePostWithDetails, User } from "@/types";
import { getCinePostsForContent } from "@/lib/cineposts";

export default function ContentCinePosts({
  contentId,
  contentType,
  currentUser,
}: {
  contentId: number;
  contentType: "movie" | "tv";
  currentUser: User | null;
}) {
  const [posts, setPosts] = useState<CinePostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      try {
        const results = await getCinePostsForContent(contentId, contentType, currentUser?.id, 12);
        if (!cancelled) setPosts(results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPosts();

    return () => {
      cancelled = true;
    };
  }, [contentId, contentType, currentUser?.id]);

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white/95 p-4 text-slate-950 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Posts</h2>
          <p className="text-sm text-slate-500">Posts, logs, and discussions anchored to this title.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <CinePostPreviewList posts={posts} emptyText="No posts for this title yet." />
      )}
    </section>
  );
}
