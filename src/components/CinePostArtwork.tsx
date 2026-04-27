"use client";

import { Sparkles } from "lucide-react";

type CinePostArtworkProps = {
  src?: string | null;
  collageImages?: string[];
  alt: string;
  className?: string;
  mediaClassName?: string;
  theme?: "default" | "brutalist";
};

export default function CinePostArtwork({
  src,
  collageImages = [],
  alt,
  className = "",
  mediaClassName = "",
  theme = "default",
}: CinePostArtworkProps) {
  const isBrutalist = theme === "brutalist";
  const images = collageImages.filter((image): image is string => Boolean(image));
  const showCollage = images.length > 1 && !src;

  return (
    <div className={`relative overflow-hidden bg-[#1a1a1a] ${className}`}>
      {showCollage ? (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-black">
          {images.slice(0, 4).map((image, index) => (
            <img
              key={`${image}-${index}`}
              src={image}
              alt={`${alt} poster ${index + 1}`}
              className={`h-full w-full object-cover ${mediaClassName}`}
            />
          ))}
          {images.length < 4 &&
            Array.from({ length: 4 - images.length }).map((_, index) => (
              <div
                key={`placeholder-${index}`}
                className={isBrutalist ? "bg-[#0d0d0d]" : "bg-slate-950"}
              />
            ))}
        </div>
      ) : src ? (
        <img src={src} alt={alt} className={`absolute inset-0 h-full w-full object-cover ${mediaClassName}`} />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${
            isBrutalist ? "bg-[#1a1a1a] text-white/35" : "bg-slate-100 text-slate-400"
          }`}
        >
          <Sparkles className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}
