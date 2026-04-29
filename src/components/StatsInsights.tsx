"use client";

import { BarChart3 } from "lucide-react";
import ReactionDistributionBar from "./ReactionDistributionBar";
import type { DetailedUserStats, StatDistributionItem } from "@/lib/profile";

interface StatsInsightsProps {
  stats: DetailedUserStats;
  onStatClick?: (type: "masterpiece" | "good" | "bad") => void;
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";

  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days === 0) return `${totalHours}h`;
  if (hours === 0) return `${days}d`;
  return `${days}d ${hours}h`;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">{title}</h3>
    </div>
  );
}

function MetricCell({
  label,
  value,
  accentClass,
  onClick,
}: {
  label: string;
  value: string | number;
  accentClass: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/35">{label}</p>
      <p className={`mt-3 text-3xl font-black tracking-tight ${accentClass}`}>{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left transition hover:opacity-90">
        {content}
      </button>
    );
  }

  return <div className="w-full">{content}</div>;
}

function DistributionRow({ item }: { item: StatDistributionItem }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm text-white/75">{item.label}</span>
        <span className="shrink-0 text-sm font-semibold text-[#f5f0de]">
          {item.percentage}% <span className="text-white/35">({item.count})</span>
        </span>
      </div>
      <div className="mt-2 h-[5px] overflow-hidden bg-white/[0.07]">
        <div
          className="h-full bg-gradient-to-r from-[#ffd7ae] to-[#ff7a1a]"
          style={{ width: `${Math.max(item.percentage, 4)}%` }}
        />
      </div>
    </div>
  );
}

function DistributionColumn({ title, items }: { title: string; items: StatDistributionItem[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-3 border-b border-white/8 pb-2">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/35">{title}</h4>
      </div>
      <div>
        {items.length > 0 ? (
          items.slice(0, 5).map((item) => <DistributionRow key={item.label} item={item} />)
        ) : (
          <p className="py-3 text-sm text-white/40">No data yet</p>
        )}
      </div>
    </div>
  );
}

export default function StatsInsights({ stats, onStatClick }: StatsInsightsProps) {
  return (
    <div className="mb-10 rounded-[2rem] border border-white/10 bg-[#090909] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6">
      <div className="flex items-center gap-3 border-b border-white/10 pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <BarChart3 className="h-5 w-5 text-[#ff7a1a]" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[#f5f0de]">Stats</h2>
        </div>
      </div>

      <section className="py-6">
        <SectionHeader title="Watching Behavior" />

        <div className="grid gap-6 md:grid-cols-4 md:divide-x md:divide-white/10">
          <MetricCell
            label="Total movies"
            value={stats.watchedCount}
            accentClass="text-[#f5f0de]"
          />
          <MetricCell
            label="Movies watched this month"
            value={stats.moviesWatchedThisMonth}
            accentClass="text-[#f5f0de]"
          />
          <MetricCell
            label="Total watch time"
            value={formatDuration(stats.estimatedWatchTimeMinutes)}
            accentClass="text-[#ffcf9d]"
          />
          <MetricCell
            label="Rewatch count"
            value={stats.rewatchCount}
            accentClass="text-[#f5f0de]"
          />
        </div>
      </section>

      <section className="border-t border-white/10 py-6">
        <SectionHeader title="Rating Personality" />

        <div className="grid gap-6 md:grid-cols-3 md:divide-x md:divide-white/10">
          <MetricCell
            label="Masterpiece"
            value={`${stats.masterpiecePercentage.toFixed(1)}%`}
            accentClass="text-[#ffcf9d]"
            onClick={onStatClick ? () => onStatClick("masterpiece") : undefined}
          />
          <MetricCell
            label="Good"
            value={`${stats.goodPercentage.toFixed(1)}%`}
            accentClass="text-[#f5f0de]"
            onClick={onStatClick ? () => onStatClick("good") : undefined}
          />
          <MetricCell
            label="Bad"
            value={`${stats.badPercentage.toFixed(1)}%`}
            accentClass="text-rose-300"
            onClick={onStatClick ? () => onStatClick("bad") : undefined}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border-t border-white/10 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/35">Rating behavior insight</p>
            <p className="mt-3 text-base leading-7 text-[#f5f0de]">{stats.ratingInsight}</p>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/35">Reaction distribution</p>
            <div className="mt-4">
              <ReactionDistributionBar
                badCount={stats.badCount}
                goodCount={stats.goodCount}
                masterpieceCount={stats.masterpieceCount}
                showLabels={true}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-6">
        <SectionHeader title="Taste Breakdown" />

        <div className="grid gap-8 lg:grid-cols-2">
          <DistributionColumn title="Genre distribution" items={stats.genreDistribution} />
          <DistributionColumn title="Top actors" items={stats.topActors} />
          <DistributionColumn title="Top directors" items={stats.topDirectors} />
          <DistributionColumn title="Language distribution" items={stats.languageDistribution} />
        </div>
      </section>
    </div>
  );
}
