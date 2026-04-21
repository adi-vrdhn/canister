"use client";

interface AchievementsProps {
  achievements: string[];
}

const BADGE_CONFIG: Record<
  string,
  { badge: string; color: string; description: string }
> = {
  "100 Movies Club": {
    badge: "100",
    color: "bg-[#fff4d6] text-[#8c631f]",
    description: "Watched 100+ movies",
  },
  "50 Films Watched": {
    badge: "50",
    color: "bg-[#ffe8cf] text-[#8a4f1b]",
    description: "Watched 50+ movies",
  },
  "Genre Specialist": {
    badge: "GEN",
    color: "bg-[#f3ecff] text-[#4d3f80]",
    description: "Master of one genre",
  },
  "Weekend Binger": {
    badge: "WKD",
    color: "bg-[#e7f2ff] text-[#1f4f8d]",
    description: "10+ movies in a week",
  },
  "Masterpiece Collector": {
    badge: "M10",
    color: "bg-[#fff0d8] text-[#7a531a]",
    description: "Marked 10+ as masterpiece",
  },
};

export default function Achievements({ achievements }: AchievementsProps) {
  return (
    <div className="mb-12">
      <h2 className="mb-6 text-2xl font-bold text-slate-900">Collector Badges</h2>

      {achievements.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {achievements.map((achievement) => {
            const config = BADGE_CONFIG[achievement] || {
              badge: "ACH",
              color: "bg-gray-100 text-gray-700",
              description: achievement,
            };
            return (
              <div
                key={achievement}
                className={`rounded-2xl border border-current p-4 text-center shadow-sm ${config.color}`}
              >
                <div className="mb-2 text-sm font-semibold tracking-[0.24em]">{config.badge}</div>
                <p className="line-clamp-2 text-xs font-bold">{achievement}</p>
                <p className="mt-1 text-xs opacity-75">{config.description}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface py-12 text-center">
          <p className="text-slate-500">No achievements yet. Keep watching.</p>
        </div>
      )}
    </div>
  );
}
