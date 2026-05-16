// Skeleton rows that mirror the shape of ScanPage search results
export default function MovieSearchSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="max-h-[34rem] overflow-y-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-white/10 py-4"
          aria-hidden="true"
        >
          {/* Poster placeholder */}
          <div className="h-20 w-14 shrink-0 animate-pulse rounded-xl bg-white/10" />

          {/* Text placeholders */}
          <div className="min-w-0 flex-1 space-y-2">
            <div
              className="h-4 animate-pulse rounded bg-white/10"
              style={{ width: `${55 + (i % 3) * 15}%` }}
            />
            <div className="h-3 w-12 animate-pulse rounded bg-white/10" />
          </div>

          {/* Arrow placeholder */}
          <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}
