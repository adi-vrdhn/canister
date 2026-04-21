"use client";

import { useState } from "react";
import { Content } from "@/types";

interface WatchHistoryProps {
  movies: Array<{ content: Content; reaction?: 0 | 1 | 2; watched_at?: string }>;
  isOwnProfile: boolean;
}

export default function WatchHistory({ movies, isOwnProfile }: WatchHistoryProps) {
  const [filter, setFilter] = useState<"all" | "masterpiece" | "bad">("all");

  const filteredMovies = movies.filter((item) => {
    if (filter === "all") return true;
    if (filter === "masterpiece") return item.reaction === 2;
    if (filter === "bad") return item.reaction === 0;
    return true;
  });

  return (
    <div className="mb-12">
      <h2 className="mb-6 text-2xl font-bold text-slate-900">Watch History</h2>

      {/* Filter Buttons */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-slate-900 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          All ({movies.length})
        </button>
        <button
          onClick={() => setFilter("masterpiece")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            filter === "masterpiece"
              ? "bg-slate-900 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Masterpiece ({movies.filter((m) => m.reaction === 2).length})
        </button>
        <button
          onClick={() => setFilter("bad")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            filter === "bad"
              ? "bg-slate-900 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Bad ({movies.filter((m) => m.reaction === 0).length})
        </button>
      </div>

      {/* Movies Grid */}
      {filteredMovies.length > 0 ? (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredMovies.map((item, index) => (
            <div key={`${item.content.type || "movie"}-${item.content.id}-${item.watched_at || "no-date"}-${index}`} className="flex flex-col">
              {/* Poster */}
              <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm transition-shadow hover:shadow-md">
                {item.content.poster_url ? (
                  <img
                    src={item.content.poster_url}
                    alt={item.content.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-slate-200" />
                )}

                {/* Reaction Badge */}
                {item.reaction !== undefined && (
                  <div
                    className={`absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${
                      item.reaction === 2 ? "bg-slate-900" : item.reaction === 1 ? "bg-slate-700" : "bg-slate-500"
                    }`}
                  >
                    {item.reaction === 2 ? "M" : item.reaction === 1 ? "G" : "B"}
                  </div>
                )}

                {/* TV Badge */}
                {item.content.type === "tv" && (
                  <div className="absolute left-2 top-2 rounded-full bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                    TV
                  </div>
                )}
              </div>

              {/* Title */}
              <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                {item.content.title}
              </p>

              {/* Date */}
              {item.watched_at && (
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(item.watched_at).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="surface py-12 text-center">
          <p className="text-slate-500">No movies in this category</p>
        </div>
      )}
    </div>
  );
}
