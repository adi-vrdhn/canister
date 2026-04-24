'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { ShareWithDetails, Content } from '@/types';
import { ref, remove, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import LogMovieModal from './LogMovieModal';
import { hasUserLoggedContent } from '@/lib/logs';

interface ShareModalProps {
  share: ShareWithDetails | null;
  currentUserId: string;
  onClose: () => void;
  user: any;
  theme?: "default" | "brutalist";
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

export default function ShareModal({
  share,
  currentUserId,
  onClose,
  user,
  theme = "default",
}: ShareModalProps) {
  const isBrutalist = theme === "brutalist";
  const router = useRouter();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const [isWatched, setIsWatched] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const movie: any = share ? (share.content || share.movie) : null;

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContextMenu]);

  if (!share) return null;

  if (!movie) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div
            className={`rounded-2xl border p-8 text-center shadow-2xl ${
              isBrutalist ? "border-white/10 bg-[#111111] text-[#f5f0de]" : "bg-white"
            }`}
          >
            <p className={isBrutalist ? "text-white/65" : "text-gray-600"}>Movie data not available</p>
            <button
              onClick={onClose}
              className={isBrutalist ? "action-primary mt-4" : "mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"}
            >
              Close
            </button>
          </div>
        </div>
      </>
    );
  }

  const posterUrl =
    movie.poster_url ||
    movie.posterUrl ||
    movie.image?.original ||
    movie.image?.medium;

  const handleNavigateToMovie = () => {
    const movieId = movie?.id;
    if (!movieId) {
      console.error('Movie ID not found');
      return;
    }
    const contentLink = share.content_type === 'tv' ? `/tv/${movieId}` : `/movie/${movieId}`;
    router.push(contentLink);
  };

  const handleNavigateToProfile = () => {
    if (share.sender?.username) {
      router.push(`/profile/${share.sender.username}`);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleMenuButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenuPos({ 
      x: rect.right - 180, 
      y: rect.bottom + 8 
    });
    setShowContextMenu(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now(),
    };

    const distance = Math.sqrt(
      Math.pow(touchEnd.x - touchStartRef.current.x, 2) +
      Math.pow(touchEnd.y - touchStartRef.current.y, 2)
    );

    // Long press: > 500ms and minimal movement
    if (touchEnd.time - touchStartRef.current.time > 500 && distance < 20) {
      setContextMenuPos({
        x: touchStartRef.current.x,
        y: touchStartRef.current.y,
      });
      setShowContextMenu(true);
      e.preventDefault();
    }

    touchStartRef.current = null;
  };

  const handleDelete = async () => {
    try {
      await remove(ref(db, `shares/${share.id}`));
      setShowContextMenu(false);
      onClose();
    } catch (error) {
      console.error('Error deleting share:', error);
    }
  };

  const handleMarkWatched = async () => {
    if (!movie) return;

    try {
      // Check if movie is already logged
      const movieId = movie.id;
      const contentType = share.content_type;
      const alreadyLogged = await hasUserLoggedContent(currentUserId, movieId, contentType as 'movie' | 'tv');

      if (!alreadyLogged) {
        // Movie not logged yet - show LogMovieModal
        setShowLogModal(true);
      } else {
        // Already logged - just mark share as watched
        await update(ref(db, `shares/${share.id}`), {
          watched: true,
          watched_at: new Date().toISOString(),
        });
        setIsWatched(true);
        setShowContextMenu(false);
      }
    } catch (error) {
      console.error('Error marking as watched:', error);
    }
  };

  const handleLogCreated = async () => {
    // After log is created, mark share as watched
    try {
      await update(ref(db, `shares/${share.id}`), {
        watched: true,
        watched_at: new Date().toISOString(),
      });
      setIsWatched(true);
      setShowLogModal(false);
      setShowContextMenu(false);
    } catch (error) {
      console.error('Error updating share:', error);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/35 transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Centered */}
      <div 
        className="fixed inset-0 z-50 flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4"
        onContextMenu={handleRightClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={`surface-strong max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-b-none rounded-t-3xl sm:max-h-[90vh] sm:rounded-3xl ${isBrutalist ? "border border-white/10 bg-[#111111] text-[#f5f0de]" : ""}`}>
          {/* Header with Close Button */}
          <div className={`sticky top-0 z-10 border-b px-4 py-3 backdrop-blur sm:p-6 ${isBrutalist ? "border-white/10 bg-[#111111]/95" : "border-slate-200 bg-white/95"}`}>
            <div className={`mx-auto mb-3 h-1 w-10 rounded-full sm:hidden ${isBrutalist ? "bg-white/20" : "bg-slate-300"}`} />
            <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className={`text-base font-semibold sm:text-xl ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Shared with you</h3>
              {isWatched && (
                <span className={`rounded-full px-2 py-1 text-xs ${isBrutalist ? "border border-white/10 bg-white/5 text-white/70" : "border border-slate-200 bg-slate-50 text-slate-600"}`}>
                  Watched
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMenuButtonClick}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                  isBrutalist
                    ? "border border-white/10 bg-[#0d0d0d] text-white/75 hover:bg-white/5"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
                title="More options"
              >
                More
              </button>
              <button
                onClick={onClose}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                  isBrutalist
                    ? "border border-white/10 bg-[#0d0d0d] text-white/75 hover:bg-white/5"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Close
              </button>
            </div>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
            {/* Movie Info Container */}
            <div className="flex gap-4 sm:gap-6">
              {/* Poster */}
              <button
                onClick={handleNavigateToMovie}
                className="cursor-pointer border-0 bg-none p-0 transition-opacity hover:opacity-80"
              >
                <div className={`h-36 w-24 overflow-hidden rounded-2xl shadow-sm sm:h-60 sm:w-40 sm:rounded-3xl ${
                  isBrutalist ? "border border-white/10 bg-[#0d0d0d]" : "border border-slate-200 bg-slate-100"
                }`}>
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={movie?.title || movie?.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center text-sm ${isBrutalist ? "bg-white/5 text-white/45" : "bg-slate-200 text-slate-500"}`}>
                      No Image
                    </div>
                  )}
                </div>
              </button>

              {/* Movie Details */}
              <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
                {/* Title */}
                <div>
                  <h2 className={`line-clamp-3 text-xl font-semibold leading-tight sm:text-3xl ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
                    {movie?.title || movie?.name}
                  </h2>
                  {(movie?.release_date || movie?.premiered) && (
                    <p className={`mt-1 text-xs sm:mt-2 sm:text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                      {new Date(
                        movie?.release_date || movie?.premiered
                      ).getFullYear()}
                    </p>
                  )}
                </div>

                {/* Sharer Info */}
                <div className={`pl-3 sm:pl-4 ${isBrutalist ? "border-l-4 border-[#ff7a1a]" : "border-l-4 border-slate-900"}`}>
                  <p className={`mb-1 text-xs sm:mb-2 sm:text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>Shared by</p>
                  <button
                    onClick={handleNavigateToProfile}
                    className={`line-clamp-1 cursor-pointer border-0 bg-none p-0 text-base font-semibold transition-colors sm:text-xl ${
                      isBrutalist ? "text-[#f5f0de] hover:text-[#ffb36b]" : "text-slate-900 hover:text-blue-600"
                    }`}
                  >
                    {share.sender?.name || share.sender?.username || 'Unknown'}
                  </button>
                </div>
              </div>
            </div>

            {/* Message Bubble (if exists) */}
            {share.note && (
              <div className={`rounded-r-2xl border-l-4 p-4 sm:rounded-r-3xl sm:p-5 ${
                isBrutalist ? "border-[#ff7a1a] bg-white/[0.03]" : "border-slate-900 bg-slate-50"
              }`}>
                <p className={`text-sm italic sm:text-base ${isBrutalist ? "text-white/70" : "text-slate-700"}`}>"{share.note}"</p>
              </div>
            )}

            {/* CTA - View Movie */}
            <button
              onClick={handleNavigateToMovie}
              className="action-primary w-full py-3 text-sm sm:py-4 sm:text-lg"
            >
              View {share.content_type === 'tv' ? 'Show' : 'Movie'} Details
            </button>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="menu-panel fixed z-50 min-w-[180px] py-2"
          style={{
            top: `${Math.min(contextMenuPos.y, window.innerHeight - 120)}px`,
            left: `${Math.min(contextMenuPos.x, window.innerWidth - 200)}px`,
          }}
        >
          <button
            onClick={handleMarkWatched}
            className="w-full px-4 py-2 text-left text-white/80 transition-colors hover:bg-white/5"
          >
            Mark watched
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-white/80 transition-colors hover:bg-white/5"
          >
            Delete from list
          </button>
        </div>
      )}

      {/* Log Movie Modal */}
      {movie && user && (
        <LogMovieModal
          isOpen={showLogModal}
          onClose={() => setShowLogModal(false)}
          content={movie as Content}
          user={user}
          onLogCreated={handleLogCreated}
          theme={isBrutalist ? "brutalist" : "default"}
        />
      )}
    </>
  );
}
