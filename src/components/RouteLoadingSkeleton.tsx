type RouteLoadingSkeletonProps = {
  title: string;
  description: string;
};

export default function RouteLoadingSkeleton({ title, description }: RouteLoadingSkeletonProps) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] px-4 py-8 text-[#f5f0de]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse bg-white/10" />
          <div className="h-8 w-72 max-w-full animate-pulse bg-white/10" />
          <div className="h-4 w-96 max-w-full animate-pulse bg-white/5" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20">
            <div className="h-5 w-40 animate-pulse bg-white/10" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="aspect-[2/3] animate-pulse bg-white/10" />
                  <div className="h-3 w-4/5 animate-pulse bg-white/10" />
                  <div className="h-2 w-1/2 animate-pulse bg-white/5" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20">
            <div className="h-5 w-48 animate-pulse bg-white/10" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                  <div className="h-14 w-10 animate-pulse bg-white/10" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse bg-white/10" />
                    <div className="h-2 w-1/2 animate-pulse bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-sm text-white/45">
          <p>{title}</p>
          <p className="mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

