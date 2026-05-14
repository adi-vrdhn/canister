"use client";

import Link from "next/link";
import { ListItemWithContent } from "@/types";

type CinePostListStripProps = {
  items: ListItemWithContent[];
  theme?: "default" | "brutalist";
  className?: string;
};

function getContentHref(item: ListItemWithContent): string {
  return item.content.type === "tv" ? `/tv/${item.content.id}` : `/movie/${item.content.id}`;
}

export default function CinePostListStrip({
  items,
  theme = "default",
  className = "",
}: CinePostListStripProps) {
  const isBrutalist = theme === "brutalist";
  const visibleItems = items.slice(0, 8);

  if (visibleItems.length === 0) return null;

  return (
    <div className={`overflow-x-auto pb-1 ${className}`}>
      <div className="flex gap-2 pr-1">
        {visibleItems.map((item) => {
          const poster = item.content.poster_url;
          const itemTitle = item.content.title || (item.content as { name?: string }).name || "Untitled";

          return (
            <Link key={item.id} href={getContentHref(item)} className="group shrink-0 w-[5.5rem] sm:w-[6.25rem]">
              <div
                className={`relative overflow-hidden border shadow-sm ${
                  isBrutalist
                    ? "border-white/10 bg-[#0d0d0d]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                  {poster ? (
                    <img
                      src={poster}
                      alt={itemTitle}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a] text-xs text-white/35">
                      No poster
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
