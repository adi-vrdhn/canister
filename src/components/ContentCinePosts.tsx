"use client";

import { useEffect, useState } from "react";
import CinePostPreviewList from "@/components/CinePostPreviewList";
import { CinePostWithDetails, User } from "@/types";
import { getCinePostsForContent } from "@/lib/cineposts";

export default function ContentCinePosts({
  contentId,
  contentType,
  currentUser,
  theme = "default",
  compact = false,
}: {
  contentId: number;
  contentType: "movie" | "tv";
  currentUser: User | null;
  theme?: "default" | "brutalist";
  compact?: boolean;
}) {
  const [posts, setPosts] = useState<CinePostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const isBrutalist = theme === "brutalist";

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      try {
        const results = await getCinePostsForContent(contentId, contentType, currentUser?.id, 200);
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
    <section
      className={`mt-8 ${compact ? "space-y-4" : `rounded-[2rem] border p-4 sm:p-6 ${isBrutalist ? "border-white/10 bg-[#111111] text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.35)]" : "border-slate-200 bg-white/95 text-slate-950 shadow-sm"}`}`}
    >
      <div className={`${compact ? "flex items-end justify-between gap-3" : "mb-4 flex items-center justify-between gap-3"}`}>
        <div>
          <h2 className={`${compact ? "text-2xl font-bold" : `text-xl font-black ${isBrutalist ? "text-[#ffb36b]" : ""}`}`}>Posts</h2>
        </div>
        {compact && (
          <span className="text-sm font-medium text-white/45">
            {posts.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <CinePostPreviewList
          posts={posts}
          emptyText="No posts for this title yet."
          theme={theme}
          className={compact ? "divide-y divide-white/10 border-t border-white/10" : ""}
        />
      )}
    </section>
  );
}
