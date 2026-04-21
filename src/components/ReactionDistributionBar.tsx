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
        <div className="flex-1 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          <span className="text-xs text-gray-400">No reactions yet</span>
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
            tick={{ fill: '#4b5563', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
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
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600">
              Bad <span className="font-semibold">{badPercent}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="text-gray-600">
              Good <span className="font-semibold">{goodPercent}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600">
              Masterpiece <span className="font-semibold">{masterpiecePercent}%</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
