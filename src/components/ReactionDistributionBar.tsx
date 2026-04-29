'use client';

interface ReactionDistributionBarProps {
  badCount: number;
  goodCount: number;
  masterpieceCount: number;
  showLabels?: boolean;
}

export default function ReactionDistributionBar({
  badCount,
  goodCount,
  masterpieceCount,
  showLabels = true,
}: ReactionDistributionBarProps) {
  const total = badCount + goodCount + masterpieceCount;
  const badPercent = total > 0 ? (badCount / total) * 100 : 0;
  const goodPercent = total > 0 ? (goodCount / total) * 100 : 0;
  const masterpiecePercent = total > 0 ? (masterpieceCount / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center border border-white/8 bg-black/20 px-4 py-5">
        <span className="text-sm text-white/40">No reactions yet</span>
      </div>
    );
  }

  const segments = [
    { name: "Bad", count: badCount, percent: badPercent, color: "#fb7185" },
    { name: "Good", count: goodCount, percent: goodPercent, color: "#ff7a1a" },
    { name: "Masterpiece", count: masterpieceCount, percent: masterpiecePercent, color: "#34d399" },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/[0.07]">
        <div className="flex h-3 w-full">
          {segments.map((segment) => (
            <div
              key={segment.name}
              className="h-full transition-all"
              style={{
                width: `${Math.max(segment.percent, 3)}%`,
                backgroundColor: segment.color,
              }}
            />
          ))}
        </div>
      </div>
      {showLabels && (
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {segments.map((segment) => (
            <div key={segment.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-white/65">{segment.name}</span>
              <span className="font-semibold text-[#f5f0de]">{segment.percent.toFixed(1)}%</span>
              <span className="text-white/35">({segment.count})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
