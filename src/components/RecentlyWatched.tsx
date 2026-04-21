"use client";

import { Content } from "@/types";

interface RecentlyWatchedProps {
  movies: Array<{ content: Content; watched_at?: string }>;
}

export default function RecentlyWatched({ movies }: RecentlyWatchedProps) {
  if (movies.length === 0) return null;

  return (
    <div className="mb-12">
      <h2 className="mb-6 text-2xl font-bold text-slate-900">Recently Watched</h2>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-5">
        {movies.map((item, index) => (
          <div key={`${item.content.type || "movie"}-${item.content.id}-${item.watched_at || "no-date"}-${index}`} className="flex flex-col">
            {/* Poster */}
            <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm transition-shadow hover:shadow-md">
              {item.content.poster_url ? (
                <img
                  src={item.content.poster_url}
                  alt={item.content.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-200" />
              )}

              {/* TV Badge */}
              {item.content.type === "tv" && (
                <div className="absolute right-2 top-2 rounded-full bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                  TV
                </div>
              )}
            </div>

            {/* Title */}
            <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.content.title}</p>

            {/* Date */}
            {item.watched_at && (
              <p className="mt-1 text-xs text-slate-500">
                {new Date(item.watched_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
