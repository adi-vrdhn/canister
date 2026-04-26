'use client';

import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Cell } from 'recharts';

interface ReactionDistributionBarProps {
  badCount: number;
  goodCount: number;
  masterpieceCount: number;
  height?: number;
  showLabels?: boolean;
}

export default function ReactionDistributionBar({
  badCount,
  goodCount,
  masterpieceCount,
  height = 220,
  showLabels = true,
}: ReactionDistributionBarProps) {
  const total = badCount + goodCount + masterpieceCount;

  // If no reactions, show empty state
  if (total === 0) {
    return (
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          <span className="text-xs text-white/45">No reactions yet</span>
        </div>
      </div>
    );
  }

  const badPercent = ((badCount / total) * 100).toFixed(1);
  const goodPercent = ((goodCount / total) * 100).toFixed(1);
  const masterpiecePercent = ((masterpieceCount / total) * 100).toFixed(1);

  const data = [
    {
      name: 'Bad',
      count: badCount,
      percent: badPercent,
      color: '#ef4444',
    },
    {
      name: 'Good',
      count: goodCount,
      percent: goodPercent,
      color: '#eab308',
    },
    {
      name: 'Masterpiece',
      count: masterpieceCount,
      percent: masterpiecePercent,
      color: '#22c55e',
    },
  ];

  const maxCount = Math.max(1, badCount, goodCount, masterpieceCount);

  return (
    <div className="w-full space-y-2">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#f5f0de', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, Math.ceil(maxCount * 1.2)]}
            hide
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {showLabels && (
        <div className="flex flex-wrap justify-center gap-4 text-sm mt-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-rose-400" />
            <span className="text-gray-600">
              <span className="text-white/65">Bad</span> <span className="font-semibold text-[#f5f0de]">{badPercent}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#ff7a1a]" />
            <span className="text-gray-600">
              <span className="text-white/65">Good</span> <span className="font-semibold text-[#f5f0de]">{goodPercent}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="text-gray-600">
              <span className="text-white/65">Masterpiece</span> <span className="font-semibold text-[#f5f0de]">{masterpiecePercent}%</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
