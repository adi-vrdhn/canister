'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { ShareReplyWithUser, ShareWithDetails, Content } from '@/types';
import { ref, remove, update, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import LogMovieModal from './LogMovieModal';
import { hasUserLoggedContent } from '@/lib/logs';
import { createShareReply, getShareReplies } from '@/lib/share-replies';
import { MessageCircle, SendHorizontal } from "lucide-react";
import { reportAppError } from "@/lib/report-error";

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
  const [replies, setReplies] = useState<ShareReplyWithUser[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(true);
  const [replySending, setReplySending] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const movie: any = share ? (share.content || share.movie) : null;
  const isSenderView = Boolean(share && share.sender_id === currentUserId);
  const counterpart = isSenderView ? share?.receiver : share?.sender;

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

  useEffect(() => {
    if (!share?.id) return;

    setReplyLoading(true);
    const repliesRef = ref(db, `share_replies/${share.id}`);
    const unsubscribe = onValue(repliesRef, async () => {
      try {
        const nextReplies = await getShareReplies(share.id, currentUserId);
        setReplies(nextReplies);
      } catch (error) {
        reportAppError({
          title: "Could not load replies",
          message: "We could not load the replies for this share.",
          details: error instanceof Error ? error.stack || error.message : String(error),
        });
        setReplies([]);
      } finally {
        setReplyLoading(false);
      }
    });

    return () => unsubscribe();
  }, [currentUserId, share?.id]);

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
    if (counterpart?.username) {
      router.push(`/profile/${counterpart.username}`);
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
      reportAppError({
        title: "Delete failed",
        message: "We could not delete this share.",
        details: error instanceof Error ? error.stack || error.message : String(error),
      });
    }
  };

  const handleSendReply = async () => {
    if (!share || !user || replyText.trim().length < 1) return;

    try {
      setReplySending(true);
      await createShareReply(share, user, replyText);
      setReplyText("");
    } catch (error) {
      reportAppError({
        title: "Reply failed",
        message: "We could not send your reply.",
        details: error instanceof Error ? error.stack || error.message : String(error),
      });
    } finally {
      setReplySending(false);
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
      reportAppError({
        title: "Could not mark as watched",
        message: "We could not update this share.",
        details: error instanceof Error ? error.stack || error.message : String(error),
      });
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
      reportAppError({
        title: "Update failed",
        message: "We could not update this share.",
        details: error instanceof Error ? error.stack || error.message : String(error),
      });
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
              <h3 className={`text-base font-semibold sm:text-xl ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
                {isSenderView ? "Shared by you" : "Shared with you"}
              </h3>
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
                  <p className={`mb-1 text-xs sm:mb-2 sm:text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                    {isSenderView ? "Sent to" : "Shared by"}
                  </p>
                  <button
                    onClick={handleNavigateToProfile}
                    className={`line-clamp-1 cursor-pointer border-0 bg-none p-0 text-base font-semibold transition-colors sm:text-xl ${
                      isBrutalist ? "text-[#f5f0de] hover:text-[#ffb36b]" : "text-slate-900 hover:text-[#f5f0de]"
                    }`}
                  >
                    {counterpart?.name || counterpart?.username || 'Unknown'}
                  </button>
                  <p className={`mt-1 text-xs sm:mt-2 sm:text-sm ${isBrutalist ? "text-white/45" : "text-slate-500"}`}>
                    Sent on {new Date(share.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
            </div>

            {/* Message Bubble (if exists) */}
            {share.note && (
              <div className={`rounded-r-2xl border-l-4 p-4 sm:rounded-r-3xl sm:p-5 ${
                isBrutalist ? "border-[#ff7a1a] bg-white/[0.03]" : "border-slate-900 bg-slate-50"
              }`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className={`text-xs font-black uppercase tracking-[0.18em] ${isBrutalist ? "text-[#ffb36b]" : "text-slate-500"}`}>
                    {isSenderView ? "Your message" : `Message from ${counterpart?.name || counterpart?.username || "Sender"}`}
                  </p>
                  <span className={`shrink-0 text-[10px] font-medium ${isBrutalist ? "text-white/45" : "text-slate-500"}`}>
                    Shared on {new Date(share.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <p className={`text-sm italic sm:text-base ${isBrutalist ? "text-white/80" : "text-slate-700"}`}>"{share.note}"</p>
              </div>
            )}

            <div className={`space-y-3 rounded-3xl border p-4 sm:p-5 ${
              isBrutalist ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isBrutalist ? "text-white/40" : "text-slate-500"}`}>Conversation</p>
                  <p className={`mt-1 text-sm ${isBrutalist ? "text-white/65" : "text-slate-500"}`}>
                    Reply here and the other person gets a notification.
                  </p>
                </div>
                <MessageCircle className={`h-5 w-5 ${isBrutalist ? "text-[#ff7a1a]" : "text-slate-400"}`} />
              </div>

              <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
                {replyLoading ? (
                  <div className="space-y-2">
                    <div className={`h-14 animate-pulse rounded-2xl ${isBrutalist ? "bg-white/5" : "bg-slate-100"}`} />
                    <div className={`h-14 animate-pulse rounded-2xl ${isBrutalist ? "bg-white/5" : "bg-slate-100"}`} />
                  </div>
                ) : replies.length === 0 ? (
                  <p className={`text-sm ${isBrutalist ? "text-white/45" : "text-slate-500"}`}>No replies yet. Start the thread.</p>
                ) : (
                  replies.map((reply) => {
                    const isMine = reply.sender_id === currentUserId;
                    return (
                      <div
                        key={reply.id}
                        className={`flex gap-3 ${isMine ? "justify-end" : ""}`}
                      >
                        {!isMine && (
                          reply.user.avatar_url ? (
                            <img
                              src={reply.user.avatar_url}
                              alt={reply.user.name}
                              className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ff7a1a] text-xs font-semibold text-[#0a0a0a]">
                              {reply.user.name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                          )
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            isMine
                              ? "bg-[#ff7a1a] text-[#0a0a0a]"
                              : isBrutalist
                                ? "bg-white/5 text-[#f5f0de]"
                                : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          <p className="font-semibold">{reply.user.name}</p>
                          <p className="mt-1 whitespace-pre-wrap leading-6">{reply.content}</p>
                        </div>
                        {isMine && (
                          reply.user.avatar_url ? (
                            <img
                              src={reply.user.avatar_url}
                              alt={reply.user.name}
                              className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ff7a1a] text-xs font-semibold text-[#0a0a0a]">
                              {reply.user.name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${counterpart?.name || counterpart?.username || "this share"}...`}
                  className={`min-h-[3.5rem] flex-1 resize-none rounded-2xl border px-3 py-2 text-sm outline-none transition ${
                    isBrutalist
                      ? "border-white/10 bg-[#0d0d0d] text-[#f5f0de] placeholder:text-white/35"
                      : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                  }`}
                  rows={2}
                />
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={replySending || replyText.trim().length < 1}
                  className={`inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition ${
                    replySending || replyText.trim().length < 1
                      ? "cursor-not-allowed opacity-50"
                      : "bg-[#ff7a1a] text-[#0a0a0a] hover:bg-[#ff8d3b]"
                  }`}
                >
                  <SendHorizontal className="h-4 w-4" />
                  Send
                </button>
              </div>
            </div>

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
          {!isSenderView && (
            <button
              onClick={handleMarkWatched}
              className="w-full px-4 py-2 text-left text-white/80 transition-colors hover:bg-white/5"
            >
              Mark watched
            </button>
          )}
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
