"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Content, User } from "@/types";
import { createLogCinePost } from "@/lib/cineposts";
import { createMovieLog, getUserMovieLogs } from "@/lib/logs";

interface LogMovieModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Content;
  user: User | null;
  onLogCreated?: () => void;
  theme?: "default" | "brutalist";
}

function formatWatchedDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function isSameContent(
  log: { content_id: number; content_type: "movie" | "tv" },
  currentContent: Content
): boolean {
  const currentType = currentContent.type === "tv" ? "tv" : "movie";
  return log.content_id === currentContent.id && log.content_type === currentType;
}

export default function LogMovieModal({
  isOpen,
  onClose,
  content,
  user,
  onLogCreated,
  theme = "default",
}: LogMovieModalProps) {
  const isBrutalist = theme === "brutalist";
  const [watchedDate, setWatchedDate] = useState(new Date().toISOString().split("T")[0]);
  const [reaction, setReaction] = useState<null | 0 | 1 | 2>(null); // 0=Bad, 1=Good, 2=Masterpiece
  const [notes, setNotes] = useState("");
  const [shareAsPost, setShareAsPost] = useState(false);
  const [postCaption, setPostCaption] = useState("");

  // Context Log
  const [showContextLog, setShowContextLog] = useState(false);
  const [location, setLocation] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [isRewatch, setIsRewatch] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previousWatchDates, setPreviousWatchDates] = useState<string[]>([]);
  const [checkingPreviousWatches, setCheckingPreviousWatches] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;

    let cancelled = false;

    const loadPreviousWatches = async () => {
      try {
        setCheckingPreviousWatches(true);
        const logs = await getUserMovieLogs(user.id, 200);
        const priorLogs = logs
          .filter((log) => isSameContent(log, content))
          .sort((a, b) => new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime())
          .map((log) => log.watched_date);

        if (!cancelled) {
          setPreviousWatchDates(priorLogs);
        }
      } catch (err) {
        console.error("Error checking previous watches:", err);
        if (!cancelled) {
          setPreviousWatchDates([]);
        }
      } finally {
        if (!cancelled) {
          setCheckingPreviousWatches(false);
        }
      }
    };

    loadPreviousWatches();

    return () => {
      cancelled = true;
    };
  }, [content, isOpen, user]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!watchedDate) {
      setError("Please select a date");
      return;
    }

    if (reaction === null) {
      setError("Please select a reaction (Bad, Good, or Masterpiece)");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const contentType = content.type === "tv" ? "tv" : "movie";

      // Build context log object, only including fields with values
      const contextLog = showContextLog
        ? Object.fromEntries(
            Object.entries({
              location,
              watched_with: watchedWith,
              rewatch: isRewatch ? "true" : undefined,
            }).filter(([, value]) => value)
          )
        : undefined;

      const newLog = await createMovieLog(
        user.id,
        content.id,
        contentType,
        watchedDate,
        reaction,
        notes,
        undefined,
        contextLog
      );

      if (shareAsPost) {
        await createLogCinePost(user, newLog, content, postCaption || notes);
      }

      // Reset form
      setWatchedDate(new Date().toISOString().split("T")[0]);
      setReaction(null);
      setNotes("");
      setShareAsPost(false);
      setPostCaption("");
      setShowContextLog(false);
      setLocation("");
      setWatchedWith("");
      setIsRewatch(false);

      onLogCreated?.();
      onClose();
    } catch (err) {
      console.error("Error logging movie:", err);
      setError("Failed to log movie. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-2 backdrop-blur-sm sm:items-center sm:p-4 md:p-6">
      <div className={`surface-strong mobile-scroll-panel w-full max-w-2xl rounded-[1.5rem] sm:rounded-[2rem] ${
        isBrutalist ? "border border-white/10 bg-[#111111] text-[#f5f0de]" : ""
      }`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-start justify-between gap-3 border-b p-4 backdrop-blur sm:p-6 md:p-7 ${
          isBrutalist ? "border-white/10 bg-[#111111]/95" : "border-slate-200 bg-white/95"
        }`}>
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href={content.type === "tv" ? `/tv/${content.id}` : `/movie/${content.id}`}
              className={`hidden overflow-hidden rounded-2xl transition-opacity hover:opacity-90 sm:block ${
                isBrutalist ? "border border-white/10" : "border border-slate-200"
              }`}
              title={`Open ${content.title}`}
            >
              {content.poster_url ? (
                <img
                  src={content.poster_url}
                  alt={content.title}
                  className="h-16 w-12 object-cover"
                />
              ) : (
                <div className={isBrutalist ? "h-16 w-12 bg-white/5" : "h-16 w-12 bg-slate-100"} />
              )}
            </Link>
            <div className="min-w-0">
              <h2 className={`text-lg font-semibold sm:text-xl ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Log Movie</h2>
              <Link
                href={content.type === "tv" ? `/tv/${content.id}` : `/movie/${content.id}`}
                className={`line-clamp-2 text-sm hover:text-slate-900 ${
                  isBrutalist ? "text-white/60 hover:text-[#f5f0de]" : "text-slate-600"
                }`}
              >
                {content.title}
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="action"
          >
            Close
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6 md:p-7">
          {checkingPreviousWatches && previousWatchDates.length === 0 && (
            <div className={`rounded-2xl px-4 py-3 text-sm ${
              isBrutalist ? "border border-white/10 bg-white/5 text-white/65" : "border border-slate-200 bg-slate-50 text-slate-600"
            }`}>
              Checking previous watches...
            </div>
          )}

          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3 transition-colors ${
            isBrutalist ? "border border-white/10 bg-white/5 hover:bg-white/[0.07]" : "border border-slate-200 bg-slate-50 hover:bg-slate-100"
          }`}>
            <input
              type="checkbox"
              checked={isRewatch || previousWatchDates.length > 0}
              onChange={(e) => setIsRewatch(e.target.checked)}
              className={`mt-1 h-4 w-4 rounded focus:ring-slate-400 ${isBrutalist ? "border-white/30 text-[#ff7a1a]" : "border-slate-300 text-slate-900"}`}
            />
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Rewatch</p>
              <p className={`text-xs ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                Tick this if you have watched it before. A new log entry will still be created.
              </p>
              {previousWatchDates.length > 0 && (
                <p className={`mt-1 text-xs ${isBrutalist ? "text-white/70" : "text-slate-600"}`}>
                  Previously logged {previousWatchDates.length} time{previousWatchDates.length === 1 ? "" : "s"}.
                </p>
              )}
            </div>
          </label>

          {error && (
            <div className={`rounded-2xl px-4 py-2 text-sm ${
              isBrutalist ? "border border-orange-500/30 bg-orange-500/10 text-orange-200" : "border border-red-200 bg-red-50 text-red-700"
            }`}>
              {error}
            </div>
          )}

          {/* Date */}
          <div>
            <label className={`mb-1 block text-sm font-medium ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
              Date Watched *
            </label>
            <input
              type="date"
              value={watchedDate}
              onChange={(e) => setWatchedDate(e.target.value)}
              required
              className="field py-2"
            />
            <p className={`mt-1 text-xs ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>{formatWatchedDate(watchedDate)}</p>
          </div>

          {/* Reaction Selection */}
          <div>
            <label className={`mb-3 block text-sm font-medium ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
              What did you think? *
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Bad */}
              <button
                type="button"
                onClick={() => setReaction(0)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                  reaction === 0
                    ? isBrutalist
                      ? "border-white/10 bg-white/5"
                      : "border-slate-900 bg-slate-50"
                    : isBrutalist
                      ? "border-white/10 hover:border-white/20"
                      : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className={`text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Bad</span>
              </button>

              {/* Good */}
              <button
                type="button"
                onClick={() => setReaction(1)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                  reaction === 1
                    ? isBrutalist
                      ? "border-white/10 bg-white/5"
                      : "border-slate-900 bg-slate-50"
                    : isBrutalist
                      ? "border-white/10 hover:border-white/20"
                      : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className={`text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Good</span>
              </button>

              {/* Masterpiece */}
              <button
                type="button"
                onClick={() => setReaction(2)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                  reaction === 2
                    ? isBrutalist
                      ? "border-orange-400/60 bg-orange-500/10 shadow-[0_0_0_1px_rgba(255,122,26,0.25)]"
                      : "border-slate-900 bg-slate-50"
                    : isBrutalist
                      ? "border-white/10 hover:border-white/20"
                      : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className={`text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Masterpiece</span>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={`mb-1 block text-sm font-medium ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
              Review
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your review"
              className="field resize-none py-3"
              rows={4}
            />
          </div>

          <div className={`rounded-3xl border p-4 ${isBrutalist ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50"}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={shareAsPost}
                onChange={(e) => setShareAsPost(e.target.checked)}
                className={`mt-1 h-4 w-4 rounded focus:ring-blue-500 ${isBrutalist ? "border-white/20 text-[#ff7a1a]" : "border-slate-300 text-blue-600"}`}
              />
              <div className="min-w-0">
                <p className={`text-sm font-bold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Share as post</p>
                <p className={`mt-1 text-xs leading-5 ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                  Creates a post like &quot;Just watched {content.title} - Good&quot; so friends can like, save, and reply.
                </p>
              </div>
            </label>

            {shareAsPost && (
              <div className="mt-4">
                <label className={`mb-1 block text-xs font-semibold ${isBrutalist ? "text-white/55" : "text-slate-600"}`}>
                  Optional post caption
                </label>
                <textarea
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  placeholder="Add a quick thought for the feed..."
                  className="field min-h-20 resize-none py-3 text-sm"
                  rows={3}
                />
                <p className={`mt-1 text-xs ${isBrutalist ? "text-white/45" : "text-slate-500"}`}>
                  If empty, your review will be used as the caption.
                </p>
              </div>
            )}
          </div>

          {/* Context Log Section */}
          <div className={`border-t pt-4 ${isBrutalist ? "border-white/10" : "border-slate-200"}`}>
            <button
              type="button"
              onClick={() => setShowContextLog(!showContextLog)}
              className={`mb-3 text-sm font-medium ${isBrutalist ? "text-white/65 hover:text-[#f5f0de]" : "text-slate-700 hover:text-slate-900"}`}
            >
              {showContextLog ? "Hide context" : "Show context"}
            </button>

            {showContextLog && (
              <div className={`space-y-3 rounded-2xl p-4 ${isBrutalist ? "bg-white/[0.03]" : "bg-slate-50"}`}>
                {/* Location */}
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isBrutalist ? "text-white/55" : "text-slate-600"}`}>
                    Where did you watch?
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Cinema, Home, Friend's place"
                    className="field py-2 text-sm"
                  />
                </div>

                {/* Watched With */}
                <div>
                  <label className={`mb-1 block text-xs font-medium ${isBrutalist ? "text-white/55" : "text-slate-600"}`}>
                    With whom?
                  </label>
                  <input
                    type="text"
                    value={watchedWith}
                    onChange={(e) => setWatchedWith(e.target.value)}
                    placeholder="e.g., @john, @sarah, family, alone"
                    className="field py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="action-primary mt-6 w-full disabled:opacity-50"
          >
            {loading ? "Logging..." : "Log Movie"}
          </button>
        </form>
      </div>
    </div>
  );
}
