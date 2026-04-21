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
    "rounded-2xl border border-[#dbc9a7] bg-[#fffaf0] p-4 " +
    (onStatClick ? "cursor-pointer hover:shadow-md transition-shadow" : "");

  return (
    <div className="mb-12 rounded-[2rem] border border-[#d8c8a6]/70 bg-[#f8f4ec] p-6 shadow-[0_18px_45px_rgba(6,9,16,0.25)]">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-[#87631f]" />
        <h2 className="text-2xl font-bold text-gray-900">Box Office Stats</h2>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <button
          type="button"
          onClick={() => onStatClick?.("total")}
          className={statCardClass}
        >
          <p className="text-gray-600 text-sm font-medium mb-1">Total Movies</p>
          <p className="text-3xl font-bold text-gray-900">{totalWatched}</p>
        </button>
        <button
          type="button"
          onClick={() => onStatClick?.("masterpiece")}
          className={statCardClass}
        >
          <p className="text-gray-600 text-sm font-medium mb-1">Masterpiece</p>
          <p className="text-3xl font-bold text-[#8d5c1f]">{masterpieceCount}</p>
        </button>
        <button
          type="button"
          onClick={() => onStatClick?.("good")}
          className={statCardClass}
        >
          <p className="text-gray-600 text-sm font-medium mb-1">Good</p>
          <p className="text-3xl font-bold text-[#1f4f8d]">{goodCount}</p>
        </button>
        <button
          type="button"
          onClick={() => onStatClick?.("bad")}
          className={statCardClass}
        >
          <p className="text-gray-600 text-sm font-medium mb-1">Bad</p>
          <p className="text-3xl font-bold text-red-600">{badCount}</p>
        </button>
      </div>

      {/* Reaction Distribution */}
      <div className="mb-8 rounded-2xl border border-[#dbc9a7] bg-[#fffaf0] p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Reaction Distribution</h3>
        <ReactionDistributionBar
          badCount={badCount}
          goodCount={goodCount}
          masterpieceCount={masterpieceCount}
          height={220}
          showLabels={true}
        />
      </div>

      {/* Genre Breakdown */}
      <div className="rounded-2xl border border-[#dbc9a7] bg-[#fffaf0] p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Top Genres</h3>
        <div className="space-y-4">
          {genres.slice(0, 5).map((genre) => (
            <div key={genre.genre}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{genre.genre}</span>
                <span className="text-sm font-bold text-gray-900">{genre.percentage}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-[#f1e6cf]">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-[#d6b470] to-[#9b6f2a] transition-all"
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
