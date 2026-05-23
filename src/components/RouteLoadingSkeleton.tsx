type RouteLoadingSkeletonProps = {
  title: string;
  description: string;
};

export default function RouteLoadingSkeleton({ title, description }: RouteLoadingSkeletonProps) {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden px-4 py-8 text-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,122,26,0.22),_transparent_28%),radial-gradient(circle_at_85%_15%,_rgba(255,173,89,0.16),_transparent_30%),linear-gradient(180deg,_#140c08_0%,_#120b07_56%,_#090504_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.06),_transparent_28%,_rgba(255,255,255,0.03)_58%,_transparent_84%)] opacity-60" />
      <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-[#ff7a1a]/20 blur-3xl" />
      <div className="absolute right-0 top-1/2 h-72 w-72 rounded-full bg-[#ff9c4a]/16 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-[#ff7a1a]/25" />
          <div className="h-8 w-72 max-w-full animate-pulse rounded-full bg-[#ff7a1a]/22" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-white/10" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <div className="h-5 w-40 animate-pulse rounded-full bg-[#ff7a1a]/22" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#ff7a1a]/16" />
                  <div className="h-3 w-4/5 animate-pulse rounded-full bg-[#ff7a1a]/18" />
                  <div className="h-2 w-1/2 animate-pulse rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <div className="h-5 w-48 animate-pulse rounded-full bg-[#ff7a1a]/22" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur-xl"
                >
                  <div className="h-14 w-10 animate-pulse rounded-xl bg-[#ff7a1a]/16" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded-full bg-[#ff7a1a]/18" />
                    <div className="h-2 w-1/2 animate-pulse rounded-full bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-4 text-sm text-[#ffe5cc]/80 shadow-2xl shadow-black/20 backdrop-blur-2xl">
          <p className="font-medium text-[#fff2e1]">{title}</p>
          <p className="mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}
