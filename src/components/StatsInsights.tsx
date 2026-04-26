"use client";

import { BarChart3 } from "lucide-react";
import ReactionDistributionBar from "./ReactionDistributionBar";

interface StatsInsightsProps {
  genres: Array<{ genre: string; percentage: number }>;
  masterpieceCount: number;
  goodCount: number;
  badCount: number;
  totalWatched: number;
  onStatClick?: (type: "total" | "masterpiece" | "good" | "bad") => void;
}

export default function StatsInsights({
  genres,
  masterpieceCount,
  goodCount,
  badCount,
  totalWatched,
  onStatClick,
}: StatsInsightsProps) {
  const statCardClass =
    "rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-left transition " +
    (onStatClick ? "cursor-pointer hover:bg-white/10" : "");

  return (
    <div className="mb-10 rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-[#1b1b1b] to-[#111111] p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-[#ff7a1a]" />
        <h2 className="text-2xl font-black text-[#f5f0de]">Stats</h2>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <button
          type="button"
          onClick={() => onStatClick?.("total")}
          className={statCardClass}
        >
          <p className="mb-1 text-sm font-medium text-white/55">Total Movies</p>
          <p className="text-3xl font-black text-[#f5f0de]">{totalWatched}</p>
        </button>
        <button
          type="button"
          onClick={() => onStatClick?.("masterpiece")}
          className={statCardClass}
        >
          <p className="mb-1 text-sm font-medium text-white/55">Masterpiece</p>
          <p className="text-3xl font-black text-[#ffb36b]">{masterpieceCount}</p>
        </button>
        <button
          type="button"
          onClick={() => onStatClick?.("good")}
          className={statCardClass}
        >
          <p className="mb-1 text-sm font-medium text-white/55">Good</p>
          <p className="text-3xl font-black text-[#f5f0de]">{goodCount}</p>
        </button>
        <button
          type="button"
          onClick={() => onStatClick?.("bad")}
          className={statCardClass}
        >
          <p className="mb-1 text-sm font-medium text-white/55">Bad</p>
          <p className="text-3xl font-black text-rose-300">{badCount}</p>
        </button>
      </div>

      {/* Reaction Distribution */}
      <div className="mb-8 rounded-[1.25rem] border border-white/10 bg-white/5 p-4 sm:p-5">
        <h3 className="mb-4 text-lg font-black text-[#f5f0de]">Reaction Distribution</h3>
        <ReactionDistributionBar
          badCount={badCount}
          goodCount={goodCount}
          masterpieceCount={masterpieceCount}
          height={220}
          showLabels={true}
        />
      </div>

      {/* Genre Breakdown */}
      <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 sm:p-5">
        <h3 className="mb-4 text-lg font-black text-[#f5f0de]">Top Genres</h3>
        <div className="space-y-4">
          {genres.slice(0, 5).map((genre) => (
            <div key={genre.genre}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-white/75">{genre.genre}</span>
                <span className="text-sm font-black text-[#f5f0de]">{genre.percentage}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-white/10">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-[#ffb36b] to-[#ff7a1a] transition-all"
                  style={{ width: `${genre.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
