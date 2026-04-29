"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { RotateCcw, Upload, X } from "lucide-react";
import { Content, User } from "@/types";
import { createLogCinePost } from "@/lib/cineposts";
import { createMovieLog, getUserMovieLogs } from "@/lib/logs";
import { reportAppError } from "@/lib/report-error";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

interface LogMovieModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Content;
  user: User | null;
  onLogCreated?: (message: string) => void;
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
  const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null);
  const [ticketUploading, setTicketUploading] = useState(false);
  const ticketInputRef = useRef<HTMLInputElement | null>(null);

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
        reportAppError({
          title: "Could not load watch history",
          message: "We could not check your previous watches for this title.",
          details: err instanceof Error ? err.stack || err.message : String(err),
        });
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

  useEffect(() => {
    if (!isOpen) return;
    setTicketImageUrl(null);
    setTicketUploading(false);
  }, [isOpen, content.id]);

  if (!user) return null;

  const handleTicketUploadClick = () => {
    ticketInputRef.current?.click();
  };

  const handleTicketFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file for your ticket or memory.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Image size must be 8MB or smaller.");
      event.target.value = "";
      return;
    }

    try {
      setTicketUploading(true);
      setError("");

      const uploadRef = storageRef(
        storage,
        `log-ticket-images/${user.id}/${content.id}/${Date.now()}-${file.name}`
      );
      await uploadBytes(uploadRef, file, {
        contentType: file.type,
      });

      const downloadUrl = await getDownloadURL(uploadRef);
      setTicketImageUrl(downloadUrl);
    } catch (err) {
      reportAppError({
        title: "Ticket upload failed",
        message: "We could not upload your ticket or memory image.",
        details: err instanceof Error ? err.stack || err.message : String(err),
      });
      setError("Failed to upload the image. Please try again.");
    } finally {
      setTicketUploading(false);
      event.target.value = "";
    }
  };

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
        contextLog,
        ticketImageUrl
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

      const contentLabel = contentType === "tv" ? "TV show" : "Movie";
      const successMessage = shareAsPost ? `${contentLabel} logged and posted` : `${contentLabel} logged`;

      onLogCreated?.(successMessage);
      onClose();
    } catch (err) {
      reportAppError({
        title: "Log failed",
        message: "We could not save this log.",
        details: err instanceof Error ? err.stack || err.message : String(err),
      });
      setError("Failed to log movie. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasPreviousWatch = previousWatchDates.length > 0;
  const isRewatchSelected = isRewatch || hasPreviousWatch;

  return (
    <div className="log-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 backdrop-blur-md sm:items-center sm:p-3 md:p-4">
      <div
        className={`log-modal-panel surface-strong mobile-scroll-panel relative w-full max-w-xl max-h-[84dvh] overflow-x-hidden overflow-y-auto rounded-[1.25rem] sm:rounded-[1.5rem] ${
          isBrutalist ? "border border-white/10 bg-[#111111] text-[#f5f0de]" : "border border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={`log-modal-glow absolute -top-24 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full blur-3xl ${
              isBrutalist ? "bg-[#ff7a1a]/18" : "bg-orange-300/35"
            }`}
          />
          <div
            className={`log-modal-glow absolute -bottom-24 -left-16 h-44 w-44 rounded-full blur-3xl ${
              isBrutalist ? "bg-white/5" : "bg-slate-200/70"
            }`}
            style={{ animationDelay: "1.2s" }}
          />
          <div
            className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff7a1a]/70 to-transparent ${
              isBrutalist ? "opacity-80" : "opacity-100"
            }`}
          />
        </div>

        {/* Header */}
        <div
          className={`sticky top-0 z-10 flex items-start justify-between gap-2 border-b p-3 backdrop-blur-xl sm:p-4 ${
            isBrutalist ? "border-white/10 bg-[#111111]/92" : "border-slate-200 bg-white/90"
          }`}
        >
          <Link
            href={content.type === "tv" ? `/tv/${content.id}` : `/movie/${content.id}`}
            className={`group flex min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-90`}
            title={`Open ${content.title}`}
          >
            <div
              className={`relative overflow-hidden rounded-2xl border ${
                isBrutalist ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-100"
              }`}
            >
              {content.poster_url ? (
                <img
                  src={content.poster_url}
                  alt={content.title}
                  className="h-16 w-12 object-cover transition duration-300 group-hover:scale-[1.03] sm:h-18 sm:w-13"
                />
              ) : (
                <div className={isBrutalist ? "h-16 w-12 bg-white/5 sm:h-18 sm:w-13" : "h-16 w-12 bg-slate-100 sm:h-18 sm:w-13"} />
              )}
            </div>
            <div className="min-w-0">
              <div className="mb-1 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em] text-[#ffb36b]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a1a]" />
                Movie log
              </div>
              <h2 className={`text-base font-semibold sm:text-lg ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Log Movie</h2>
              <p
                className={`line-clamp-1 text-xs sm:text-sm ${
                  isBrutalist ? "text-white/60 group-hover:text-[#f5f0de]" : "text-slate-600 group-hover:text-slate-900"
                }`}
              >
                {content.title}
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="action px-3 py-2 text-sm sm:px-4 sm:py-2.5"
          >
            Close
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-3 sm:space-y-5 sm:p-4">
          {checkingPreviousWatches && previousWatchDates.length === 0 && (
            <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
              isBrutalist ? "border border-white/10 bg-white/5 text-white/65" : "border border-slate-200 bg-slate-50 text-slate-600"
            }`}>
              Checking previous watches...
            </div>
          )}

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-[1.25rem] px-3 py-3 transition-all ${
              isBrutalist
                ? "border border-white/10 bg-white/[0.04] shadow-[0_12px_30px_rgba(0,0,0,0.18)] hover:bg-white/[0.06]"
                : "border border-slate-200 bg-slate-50 shadow-sm hover:bg-slate-100"
            }`}
          >
            <input
              type="checkbox"
              checked={isRewatchSelected}
              onChange={(e) => setIsRewatch(e.target.checked)}
              className="sr-only"
            />
            <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${
              isRewatchSelected
                ? isBrutalist
                  ? "border-[#ff7a1a]/40 bg-[#ff7a1a]/12 text-[#ffb36b]"
                  : "border-orange-200 bg-orange-50 text-orange-600"
                : isBrutalist
                  ? "border-white/10 bg-white/5 text-white/45"
                  : "border-slate-200 bg-white text-slate-400"
            }`}>
              <RotateCcw className={`h-4 w-4 ${isRewatchSelected ? "rewatch-icon-spin" : ""}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Rewatch</p>
                {hasPreviousWatch ? (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.22em] ${
                    isBrutalist ? "bg-white/5 text-[#ffb36b]" : "bg-orange-100 text-orange-700"
                  }`}>
                    Seen before
                  </span>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.22em] ${
                    isBrutalist ? "bg-white/5 text-white/55" : "bg-slate-100 text-slate-500"
                  }`}>
                    Fresh watch
                  </span>
                )}
              </div>
              <p className={`mt-1 text-xs leading-5 ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                Tick this if you have watched it before. A new log entry will still be created.
              </p>
              {hasPreviousWatch && (
                <p className={`mt-2 text-xs ${isBrutalist ? "text-white/70" : "text-slate-600"}`}>
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
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Bad */}
              <button
                type="button"
                onClick={() => setReaction(0)}
                className={`flex aspect-[1/1.05] w-full items-center justify-center rounded-[1rem] border px-2 py-2 text-center transition-all duration-200 ${
                  reaction === 0
                    ? isBrutalist
                      ? "border-white/15 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                      : "border-slate-900 bg-slate-50 shadow-sm"
                    : isBrutalist
                      ? "border-white/10 hover:border-white/20"
                      : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className={`text-sm font-bold sm:text-base ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Bad</span>
              </button>

              {/* Good */}
              <button
                type="button"
                onClick={() => setReaction(1)}
                className={`flex aspect-[1/1.05] w-full items-center justify-center rounded-[1rem] border px-2 py-2 text-center transition-all duration-200 ${
                  reaction === 1
                    ? isBrutalist
                      ? "border-white/15 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                      : "border-slate-900 bg-slate-50 shadow-sm"
                    : isBrutalist
                      ? "border-white/10 hover:border-white/20"
                      : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className={`text-sm font-bold sm:text-base ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Good</span>
              </button>

              {/* Masterpiece */}
              <button
                type="button"
                onClick={() => setReaction(2)}
                className={`flex aspect-[1/1.05] w-full items-center justify-center rounded-[1rem] border px-2 py-2 text-center transition-all duration-200 ${
                  reaction === 2
                    ? isBrutalist
                      ? "border-[#ff7a1a]/65 bg-[#ff7a1a]/12 text-[#ffb36b] shadow-[0_0_0_1px_rgba(255,122,26,0.25),0_0_34px_rgba(255,122,26,0.32)]"
                      : "border-slate-900 bg-slate-50 shadow-sm"
                    : isBrutalist
                      ? "border-white/10 hover:border-white/20"
                      : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className={`text-sm font-black leading-tight sm:text-base ${reaction === 2 && isBrutalist ? "text-[#ffb36b]" : isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Masterpiece</span>
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
              rows={3}
            />
          </div>

          <div className={`rounded-[1.25rem] border p-3 ${isBrutalist ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50"}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={shareAsPost}
                onChange={(e) => setShareAsPost(e.target.checked)}
                className={`mt-1 h-4 w-4 rounded focus:ring-blue-500 ${isBrutalist ? "border-white/20 text-[#ff7a1a]" : "border-slate-300 text-[#f5f0de]"}`}
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
                  rows={2}
                />
                <p className={`mt-1 text-xs ${isBrutalist ? "text-white/45" : "text-slate-500"}`}>
                  If empty, your review will be used as the caption.
                </p>
              </div>
            )}
          </div>

          <div className={`rounded-[1.25rem] border p-3 ${isBrutalist ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className={`text-sm font-bold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
                  Ticket or memory image
                </p>
                <p className={`mt-1 text-xs leading-5 ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                  Front stays the poster. Back becomes your ticket, receipt, or memory shot.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTicketUploadClick}
                disabled={ticketUploading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff7a1a] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-black transition hover:bg-[#ff8d3b] disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5" />
                {ticketImageUrl ? "Replace image" : ticketUploading ? "Uploading" : "Upload image"}
              </button>
            </div>

            {ticketImageUrl ? (
              <div className="mt-3 overflow-hidden rounded-[1rem] border border-white/10 bg-black/20">
                <img
                  src={ticketImageUrl}
                  alt="Uploaded ticket or memory"
                  className="h-44 w-full object-cover"
                />
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <p className={`truncate text-xs ${isBrutalist ? "text-white/60" : "text-slate-500"}`}>
                    Uploaded and ready for this log.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTicketImageUrl(null)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${
                      isBrutalist ? "bg-white/5 text-white/60 hover:bg-white/10" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`mt-3 rounded-[1rem] border border-dashed px-4 py-5 text-center text-sm ${
                  isBrutalist ? "border-white/10 bg-black/20 text-white/50" : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                No image selected yet.
              </div>
            )}

            <input
              ref={ticketInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleTicketFileChange}
            />
          </div>

          {/* Context Log Section */}
          <div className={`border-t pt-3 ${isBrutalist ? "border-white/10" : "border-slate-200"}`}>
            <button
              type="button"
              onClick={() => setShowContextLog(!showContextLog)}
              className={`mb-2 text-sm font-medium ${isBrutalist ? "text-white/65 hover:text-[#f5f0de]" : "text-slate-700 hover:text-slate-900"}`}
            >
              {showContextLog ? "Hide context" : "Show context"}
            </button>

            {showContextLog && (
              <div className={`space-y-3 rounded-[1.25rem] p-3 ${isBrutalist ? "bg-white/[0.03]" : "bg-slate-50"}`}>
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
            disabled={loading || ticketUploading}
            className="action-primary mt-6 w-full disabled:opacity-50"
          >
            {loading ? "Logging..." : ticketUploading ? "Uploading image..." : "Log Movie"}
          </button>
        </form>
      </div>
    </div>
  );
}
