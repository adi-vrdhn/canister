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
}: {
  contentId: number;
  contentType: "movie" | "tv";
  currentUser: User | null;
  theme?: "default" | "brutalist";
}) {
  const [posts, setPosts] = useState<CinePostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const isBrutalist = theme === "brutalist";

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
    <section
      className={`mt-8 rounded-[2rem] border p-4 sm:p-6 ${
        isBrutalist
          ? "border-white/10 bg-[#111111] text-[#f5f0de] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
          : "border-slate-200 bg-white/95 text-slate-950 shadow-sm"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className={`text-xl font-black ${isBrutalist ? "text-[#ffb36b]" : ""}`}>Posts</h2>
          <p className={`text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
            Posts, logs, and discussions anchored to this title.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <CinePostPreviewList posts={posts} emptyText="No posts for this title yet." theme={theme} />
      )}
    </section>
  );
}
