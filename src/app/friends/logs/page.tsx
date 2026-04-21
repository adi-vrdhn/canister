"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { User, MovieLogWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getFriendLogs } from "@/lib/friend-logs";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function FriendLogsPage() {
  // --- Season filter state ---
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<(MovieLogWithContent & { friend: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"recent" | "highest-rated">("recent");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          router.push("/auth/login");
          return;
        }
        // Optionally fetch userData from your DB here if needed
        // For now, just use firebaseUser
        const currentUser: User = {
          id: firebaseUser.uid,
          username: firebaseUser.email?.split("@")[0] || "user",
          name: firebaseUser.displayName || "User",
          avatar_url: null,
          created_at: new Date().toISOString(),
        };
        setUser(currentUser);
        // Fetch friend logs (all, not just first 20)
        const friendLogs = await getFriendLogs(currentUser.id, 14, 100);
        setLogs(friendLogs);
        setLoading(false);
      } catch (error) {
        console.error("Error loading friend logs:", error);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year.slice(-2)}`;
  };

  const getReactionLabel = (reaction: 0 | 1 | 2) => {
    switch (reaction) {
      case 2:
        return { label: "Masterpiece", color: "text-slate-700" };
      case 1:
        return { label: "Good", color: "text-slate-700" };
      case 0:
      default:
        return { label: "Bad", color: "text-slate-700" };
    }
  };

  // Filter logs by season if seasonFilter is set (and log.season exists)
  const filteredLogs = seasonFilter === "all"
    ? logs
    : logs.filter(log => log.season === Number(seasonFilter));

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    if (sortBy === "highest-rated") {
      return (b.reaction || 0) - (a.reaction || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (loading || !user) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="mx-auto max-w-5xl p-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="action"
          >
            Back
          </button>
          <h1 className="text-4xl font-bold text-slate-900">Friends' Recent Logs</h1>
        </div>

        {/* Season Filter & Sort Controls */}
        <div className="mb-8 flex gap-3 items-center flex-wrap">
          {/* Season Filter Dropdown */}
          <label htmlFor="season-filter" className="text-sm font-medium text-slate-700">Season:</label>
          <select
            id="season-filter"
            value={seasonFilter}
            onChange={e => setSeasonFilter(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="all">All Seasons</option>
            {/* Dynamically generate season options from logs */}
            {Array.from(new Set(logs.filter(l => l.season).map(l => l.season))).sort((a, b) => (a as number) - (b as number)).map(season => (
              <option key={season} value={season as number}>Season {season}</option>
            ))}
          </select>

        </div>
        {/* Sort Buttons */}
        <div className="mb-8 flex gap-3">
          <button
            onClick={() => setSortBy("recent")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              sortBy === "recent"
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Most Recent
          </button>
          <button
            onClick={() => setSortBy("highest-rated")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              sortBy === "highest-rated"
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Highest Rated
          </button>
        </div>

        {/* Logs Grid */}
        {sortedLogs.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => router.push(`/logs/${log.id}`)}
                className="surface cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Poster */}
                {log.content.poster_url && (
                  <div className="relative h-64 overflow-hidden bg-slate-100">
                    <img
                      src={log.content.poster_url}
                      alt={log.content.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="p-5">
                  {/* Movie Title */}
                  <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-slate-900">
                    {log.content.title}
                  </h3>

                  {/* Friend Info */}
                  <div className="mb-3">
                    <p className="text-sm text-slate-500">
                      by {log.friend.name}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="mb-3 text-sm text-slate-500">
                    {formatDate(log.watched_date)}
                  </div>

                  {/* Reaction */}
                  <div className="mb-3">
                    {(() => {
                      const reaction = getReactionLabel(log.reaction as 0 | 1 | 2);
                      return <span className={`text-sm font-medium ${reaction.color}`}>{reaction.label}</span>;
                    })()}
                  </div>

                  {/* Mood */}
                  {log.mood && (
                    <div className="mb-3">
                      <span className="chip text-xs font-medium">
                        {log.mood}
                      </span>
                    </div>
                  )}

                  {/* Notes Preview */}
                  {log.notes && (
                    <p className="line-clamp-2 text-sm text-slate-600">
                      {log.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="surface py-16 text-center">
            <p className="mb-2 font-medium text-slate-700">No friend logs yet</p>
            <p className="text-sm text-slate-500">Follow friends to see their movie logs</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
