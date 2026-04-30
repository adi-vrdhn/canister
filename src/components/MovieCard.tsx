"use client";

import { Movie, TVShow, Content } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { Heart, Flame } from "lucide-react";
import { getBlurDataUrl } from "@/lib/performance";

interface MovieCardProps {
  movie?: Movie | TVShow | Content;
  sharedBy?: string;
  onShare?: () => void;
  reactions?: { hearts: number; fires: number };
  disableLink?: boolean;
  compact?: boolean;
}

export default function MovieCard({
  movie,
  sharedBy,
  onShare,
  reactions,
  disableLink = false,
  compact = false,
}: MovieCardProps) {
  // Handle null/undefined movie
  if (!movie) {
    console.error("MovieCard: No movie provided");
    return (
      <div className="flex-shrink-0 w-40">
        <div className="relative h-56 bg-gray-200 rounded-lg overflow-hidden shadow-md flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-sm">Content not found</p>
          </div>
        </div>
      </div>
    );
  }

  const title = (movie as any).title || (movie as any).name || "Untitled";
  const isTV = (movie as any).type === "tv";
  const movieId = movie.id;
  const detailPageLink = isTV ? `/tv/${movieId}` : `/movie/${movieId}`;

  const cardContent = (
    <div className="group cursor-pointer w-full transition-transform duration-200 hover:scale-105 hover:shadow-[0_0_16px_4px_rgba(59,130,246,0.3)]">
      {/* Poster Container */}
      <div className="relative w-full aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
        {/* Image */}
        {movie.poster_url ? (
          <Image
            src={movie.poster_url}
            alt={title}
            fill
            sizes={compact ? "160px" : "240px"}
            className="object-cover"
            placeholder="blur"
            blurDataURL={getBlurDataUrl()}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-500">
            No image
          </div>
        )}

        {/* Type Badge */}
        {isTV && (
          <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full z-5">
            TV
          </div>
        )}

        {/* Overlay - appears on hover only, doesn't block image */}
        {onShare && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center pointer-events-none z-10">
            <button
              onClick={onShare}
              className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black px-3 py-2 rounded-lg text-xs font-medium pointer-events-auto"
            >
              Share
            </button>
          </div>
        )}
      </div>

      {/* Details */}
      <div className={compact ? "mt-2" : "mt-3"}>
        <h3 className={`${compact ? "text-[11px] leading-tight" : "text-sm"} font-semibold line-clamp-2 text-gray-900`}>
          {title}
        </h3>

        {sharedBy && (
          <p className={`${compact ? "text-[10px] leading-tight" : "text-xs"} mt-1 truncate text-gray-500`}>Shared by {sharedBy}</p>
        )}

        {reactions && (
          <div className="flex gap-2 mt-2 text-xs">
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3 fill-red-500 text-red-500" />
              <span className="text-gray-600">{reactions.hearts}</span>
            </div>
            <div className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500" />
              <span className="text-gray-600">{reactions.fires}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (disableLink) {
    return cardContent;
  }
  return <Link href={detailPageLink}>{cardContent}</Link>;
}
