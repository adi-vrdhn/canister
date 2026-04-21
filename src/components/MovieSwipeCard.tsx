"use client";

import React, { useRef, useState, useEffect } from "react";
import { Content } from "@/types";
import { Heart, X, Clock, Zap } from "lucide-react";

interface MovieSwipeCardProps {
  movie: Content;
  onSwipeRight: () => void; // Good
  onSwipeLeft: () => void; // Bad
  onSwipeDown: () => void; // Watchlist
  onDoubleTap: () => void; // Masterpiece
  isLoading?: boolean;
}

export default function MovieSwipeCard({
  movie,
  onSwipeRight,
  onSwipeLeft,
  onSwipeDown,
  onDoubleTap,
  isLoading = false,
}: MovieSwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [exitDirection, setExitDirection] = useState<string | null>(null);

  const year = movie.release_date ? movie.release_date.split("-")[0] : "N/A";
  const posterUrl = movie.poster_url ? `https://image.tmdb.org/t/p/w342${movie.poster_url}` : null;

  const startDrag = (clientX: number, clientY: number) => {
    setStartX(clientX);
    setStartY(clientY);
    setIsDragging(true);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    setTranslateX(deltaX);
    setTranslateY(deltaY);
    setRotation((deltaX / window.innerWidth) * 20); // Max 20deg rotation
  };

  const endDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 80; // pixels to trigger action
    const verticalThreshold = 100;

    if (Math.abs(translateX) > threshold) {
      if (translateX > 0) {
        onSwipeRight();
        setExitDirection("right");
      } else {
        onSwipeLeft();
        setExitDirection("left");
      }
      return;
    }

    if (translateY > verticalThreshold) {
      onSwipeDown();
      setExitDirection("down");
      return;
    }

    setTranslateX(0);
    setTranslateY(0);
    setRotation(0);
  };

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    startDrag(e.touches[0].clientX, e.touches[0].clientY);

    // Double tap detection
    const now = Date.now();
    if (lastTap && now - lastTap < 300) {
      onDoubleTap();
      setLastTap(0);
      return;
    }
    setLastTap(now);
  };

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  };

  // Handle touch end
  const handleTouchEnd = () => {
    endDrag();
  };

  // Desktop pointer support
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startDrag(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    moveDrag(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    endDrag();
  };

  // Reset after action
  useEffect(() => {
    if (exitDirection) {
      const timer = setTimeout(() => {
        setTranslateX(0);
        setTranslateY(0);
        setRotation(0);
        setExitDirection(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [exitDirection]);

  const isExiting = exitDirection !== null;
  const exitX = exitDirection === "right" ? 500 : exitDirection === "left" ? -500 : 0;
  const exitY = exitDirection === "down" ? 500 : 0;
  const exitRotation = exitDirection === "right" ? 45 : exitDirection === "left" ? -45 : 0;

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div
          ref={cardRef}
          className="relative cursor-grab active:cursor-grabbing"
          style={{
            transform: isExiting
              ? `translateX(${exitX}px) translateY(${exitY}px) rotate(${exitRotation}deg)`
              : `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotation}deg)`,
            transition: isExiting ? "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
            touchAction: "none",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={onDoubleTap}
        >
          {/* Polaroid Card */}
          <div className="bg-white rounded-lg shadow-2xl overflow-hidden" style={{ aspectRatio: "9/12" }}>
            {/* Poster Image */}
            <div className="relative w-full h-5/6 bg-gray-200 overflow-hidden">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400">
                  <span className="text-gray-600 text-center px-4">No poster available</span>
                </div>
              )}

              {/* Action Badges on Hover */}
              {!isExiting && (
                <>
                  {translateX > 20 && (
                    <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <Heart size={16} /> Good
                    </div>
                  )}
                  {translateX < -20 && (
                    <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <X size={16} /> Bad
                    </div>
                  )}
                  {translateY > 20 && (
                    <div className="absolute bottom-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <Clock size={16} /> Watch Later
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Polaroid Footer */}
            <div className="h-1/6 bg-white p-3 flex flex-col justify-between">
              <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{movie.title}</h3>
              <p className="text-xs text-gray-500">{year}</p>
            </div>
          </div>

          {/* Masterpiece Indicator (double-tap hint) */}
          <div className="absolute -top-8 right-0 text-xs text-gray-400 flex items-center gap-1">
            <Zap size={14} /> Double-tap for masterpiece
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center text-gray-400 text-xs space-y-1">
          <p>👉 Swipe <span className="text-green-400">right</span> for good</p>
          <p>👈 Swipe <span className="text-red-400">left</span> for bad</p>
          <p>👇 Swipe <span className="text-blue-400">down</span> for watchlist</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSwipeLeft}
            className="rounded-lg bg-red-600 text-white text-sm font-medium py-2 hover:bg-red-700"
          >
            Bad
          </button>
          <button
            type="button"
            onClick={onSwipeRight}
            className="rounded-lg bg-green-600 text-white text-sm font-medium py-2 hover:bg-green-700"
          >
            Good
          </button>
          <button
            type="button"
            onClick={onSwipeDown}
            className="rounded-lg bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700"
          >
            Watchlist
          </button>
          <button
            type="button"
            onClick={onDoubleTap}
            className="rounded-lg bg-amber-500 text-white text-sm font-medium py-2 hover:bg-amber-600"
          >
            Masterpiece
          </button>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
          </div>
        )}
      </div>
    </div>
  );
}
