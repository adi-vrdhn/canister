"use client";

interface PersonalityCardProps {
  title: string;
  loves: string[];
  avoids: string[];
  vibeHollywood: number;
  vibeBollywood: number;
}

export default function PersonalityCard({
  title,
  loves,
  avoids,
  vibeHollywood,
  vibeBollywood,
}: PersonalityCardProps) {
  return (
    <div className="surface mb-8 bg-white p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl border border-slate-200 bg-slate-100" />
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">Your Movie Personality</h2>
          <p className="mt-1 text-lg font-semibold text-slate-600">You are a: {title}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-6">
        {/* Loves */}
        <div>
          <h3 className="mb-3 font-semibold text-slate-900">You Love</h3>
          <div className="flex flex-wrap gap-2">
            {loves.length > 0 ? (
              loves.map((genre) => (
                <span
                  key={genre}
                  className="chip text-sm font-medium"
                >
                  {genre}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">Mix of genres</p>
            )}
          </div>
        </div>

        {/* Avoids */}
        <div>
          <h3 className="mb-3 font-semibold text-slate-900">You Avoid</h3>
          <div className="flex flex-wrap gap-2">
            {avoids.length > 0 ? (
              avoids.map((genre) => (
                <span
                  key={genre}
                  className="chip text-sm font-medium"
                >
                  {genre}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">Adventurous</p>
            )}
          </div>
        </div>
      </div>

      {/* Vibe Breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 font-semibold text-slate-900">Your Vibe</h3>
        <div className="space-y-2">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">Hollywood</span>
              <span className="font-semibold text-slate-900">{vibeHollywood}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-slate-900 transition-all"
                style={{ width: `${vibeHollywood}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">Bollywood</span>
              <span className="font-semibold text-slate-900">{vibeBollywood}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-slate-600 transition-all"
                style={{ width: `${vibeBollywood}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Share Button */}
      <button className="action-primary mt-4 w-full">
        Share Personality
      </button>
    </div>
  );
}
