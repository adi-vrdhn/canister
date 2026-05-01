"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Check, Upload } from "lucide-react";
import { Content, MovieLog, MovieLogWithContent, User } from "@/types";
import { createLogCinePost } from "@/lib/cineposts";
import { createMovieLog, getUserMovieLogs, updateMovieLog } from "@/lib/logs";
import { reportAppError } from "@/lib/report-error";

interface LogMovieModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Content;
  user: User | null;
  onLogCreated?: (message: string) => void;
  mode?: "create" | "edit";
  existingLog?: MovieLogWithContent | null;
  onLogUpdated?: (log: MovieLogWithContent) => void;
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function LogMovieModal({
  isOpen,
  onClose,
  content,
  user,
  onLogCreated,
  mode = "create",
  existingLog = null,
  onLogUpdated,
  theme = "default",
}: LogMovieModalProps) {
  const isEditMode = mode === "edit";
  const isBrutalist = theme === "brutalist";
  const [watchedDate, setWatchedDate] = useState(new Date().toISOString().split("T")[0]);
  const [reaction, setReaction] = useState<null | 0 | 1 | 2>(null); // 0=Bad, 1=Good, 2=Masterpiece
  const [notes, setNotes] = useState("");
  const [shareAsPost, setShareAsPost] = useState(false);
  const [postCaption, setPostCaption] = useState("");
  const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null);
  const [ticketUploading, setTicketUploading] = useState(false);
  const [showReviewEditor, setShowReviewEditor] = useState(false);
  const [reviewDraft, setReviewDraft] = useState("");
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
          if (!isEditMode) {
            setIsRewatch(priorLogs.length > 0);
          }
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
    if (isEditMode && existingLog) {
      setWatchedDate(existingLog.watched_date || new Date().toISOString().split("T")[0]);
      setReaction((typeof existingLog.reaction === "number" ? existingLog.reaction : 1) as 0 | 1 | 2);
      setNotes(existingLog.notes || "");
      setTicketImageUrl(existingLog.ticket_image_url || null);
      setShowReviewEditor(false);
      setReviewDraft(existingLog.notes || "");

      const existingContext = existingLog.context_log || {};
      setShowContextLog(Boolean(existingContext.location || existingContext.watched_with || existingContext.mood));
      setLocation(existingContext.location || "");
      setWatchedWith(existingContext.watched_with || "");
      const rewatchValue = (existingContext as Record<string, unknown>).rewatch;
      setIsRewatch(rewatchValue === "true" || rewatchValue === true);
      setShareAsPost(false);
      setPostCaption("");
      setError("");
    } else {
      setTicketImageUrl(null);
      setWatchedDate(new Date().toISOString().split("T")[0]);
      setReaction(null);
      setNotes("");
      setShareAsPost(false);
      setPostCaption("");
      setShowContextLog(false);
      setLocation("");
      setWatchedWith("");
      setIsRewatch(false);
      setShowReviewEditor(false);
      setReviewDraft("");
      setError("");
    }
    setTicketUploading(false);
  }, [existingLog, isEditMode, isOpen, content.id]);

  if (!user) return null;

  const openReviewEditor = () => {
    setReviewDraft(notes);
    setShowReviewEditor(true);
  };

  const saveReviewDraft = () => {
    setNotes(reviewDraft);
    setShowReviewEditor(false);
  };

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
      const dataUrl = await fileToDataUrl(file);
      setTicketImageUrl(dataUrl);
    } catch (err) {
      reportAppError({
        title: "Ticket upload failed",
        message: "We could not save your ticket or memory image.",
        details: err instanceof Error ? err.stack || err.message : String(err),
      });
      setError("Failed to save the image. Please try again.");
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

      if (isEditMode) {
        if (!existingLog) {
          throw new Error("Missing log to edit");
        }

        const updates: Partial<MovieLog> = {
          watched_date: watchedDate,
          reaction,
          notes,
          ticket_image_url: ticketImageUrl || null,
          context_log: Object.keys(contextLog || {}).length > 0 ? (contextLog as MovieLog["context_log"]) : {},
        };

        await updateMovieLog(existingLog.id, updates);

        onLogUpdated?.({
          ...existingLog,
          ...updates,
          id: existingLog.id,
          watched_date: watchedDate,
          reaction,
          notes,
          ticket_image_url: ticketImageUrl || null,
          context_log: updates.context_log || {},
        } as MovieLogWithContent);
      } else {
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
      setShowReviewEditor(false);
      setReviewDraft("");

      const contentLabel = contentType === "tv" ? "TV show" : "Movie";
      const successMessage = isEditMode
        ? `${contentLabel} updated`
        : shareAsPost
          ? `${contentLabel} logged and posted`
          : `${contentLabel} logged`;

      if (!isEditMode) {
        onLogCreated?.(successMessage);
      }
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

  return (
    <>
      {showReviewEditor && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-2 backdrop-blur-md sm:p-3 md:p-4"
          onClick={() => setShowReviewEditor(false)}
        >
          <div
            className={`log-modal-panel surface-strong mobile-scroll-panel relative flex w-full max-w-xl max-h-[84dvh] flex-col overflow-hidden rounded-[1.25rem] sm:rounded-[1.5rem] ${
              isBrutalist ? "border border-white/10 bg-[#111111] text-[#f5f0de]" : "border border-slate-200 bg-white text-slate-900"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`sticky top-0 z-10 border-b p-3 backdrop-blur-xl sm:p-4 ${
                isBrutalist ? "border-white/10 bg-[#111111]/92" : "border-slate-200 bg-white/90"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffb36b]">
                Review editor
              </p>
              <h3 className={`mt-1 text-base font-semibold sm:text-lg ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
                Expand your review
              </h3>
              <p className={`mt-1 text-xs sm:text-sm ${isBrutalist ? "text-white/60" : "text-slate-600"}`}>
                Write freely here, then save to return to the log form.
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
              <textarea
                value={reviewDraft}
                onChange={(e) => setReviewDraft(e.target.value)}
                placeholder="Write your review"
                className="field min-h-[44dvh] flex-1 resize-none rounded-[1.25rem] py-4"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReviewEditor(false)}
                  className="action px-4 py-2 text-sm sm:px-5"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={saveReviewDraft}
                  className="action-primary px-4 py-2 text-sm sm:px-5"
                >
                  Save review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
                {isEditMode ? "Edit log" : "Movie log"}
              </div>
              <h2 className={`text-base font-semibold sm:text-lg ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
                {isEditMode ? "Edit Movie Log" : "Log Movie"}
              </h2>
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
          {!isEditMode && checkingPreviousWatches && previousWatchDates.length === 0 && (
            <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
              isBrutalist ? "border border-white/10 bg-white/5 text-white/65" : "border border-slate-200 bg-slate-50 text-slate-600"
            }`}>
              Checking previous watches...
            </div>
          )}

          {!isEditMode && (
            <button
              type="button"
              onClick={() => setIsRewatch((value) => !value)}
              className={`flex w-full items-start gap-3 text-left transition-opacity hover:opacity-95`}
            >
              <div
                className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[0.65rem] border ${
                  isRewatch
                    ? isBrutalist
                      ? "border-[#ff7a1a]/45 bg-[#ff7a1a]/14 text-[#ffb36b]"
                      : "border-slate-900 bg-slate-900 text-white"
                    : isBrutalist
                      ? "border-white/15 bg-white/5 text-white/35"
                      : "border-slate-300 bg-white text-slate-300"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Visited</p>
                <p className={`mt-1 text-xs leading-5 ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                  Mark this if you&apos;ve visited this title before.
                </p>
                {hasPreviousWatch && (
                  <p className={`mt-1 text-xs ${isBrutalist ? "text-white/70" : "text-slate-600"}`}>
                    Visited {previousWatchDates.length} time{previousWatchDates.length === 1 ? "" : "s"} before.
                  </p>
                )}
              </div>
            </button>
          )}

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
            <button
              type="button"
              onClick={openReviewEditor}
              aria-label="Open review editor"
              className={`mt-1 flex min-h-28 w-full flex-col justify-between rounded-[1.35rem] border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                isBrutalist
                  ? "border-white/10 bg-white/5 hover:border-white/20"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <span className={`block whitespace-pre-wrap text-sm leading-6 ${
                notes.trim() ? (isBrutalist ? "text-[#f5f0de]" : "text-slate-900") : (isBrutalist ? "text-white/40" : "text-slate-400")
              }`}>
                {notes.trim() || "Tap to write your review"}
              </span>
              <span className={`mt-3 text-xs font-medium ${
                isBrutalist ? "text-[#ffb36b]/80" : "text-slate-500"
              }`}>
                Tap to open the full review box
              </span>
            </button>
          </div>

          {!isEditMode && (
            <div className="pt-1">
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
                <div className="mt-3">
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
          )}

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleTicketUploadClick}
              disabled={ticketUploading}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-[#ff7a1a] px-3.5 py-1.75 text-[10px] font-black uppercase tracking-[0.18em] text-black transition hover:bg-[#ff8d3b] disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" />
              {ticketImageUrl ? "Replace" : ticketUploading ? "Uploading" : "Upload"}
            </button>
            {ticketImageUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={ticketImageUrl}
                  alt="Uploaded ticket or memory"
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
                    Image uploaded with preview
                  </p>
                  <p className={`mt-1 text-xs ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                    Your attachment is ready for this log.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTicketImageUrl(null)}
                  className={`shrink-0 text-xs font-medium ${isBrutalist ? "text-white/60 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className={`min-w-0 text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                Add one image attachment if you want a ticket or memory preview.
              </p>
            )}
            <input ref={ticketInputRef} type="file" accept="image/*" className="hidden" onChange={handleTicketFileChange} />
          </div>

          {/* Context Log Section */}
          <div className="pt-3">
            <button
              type="button"
              onClick={() => setShowContextLog(!showContextLog)}
              className={`mb-2 text-sm font-medium ${isBrutalist ? "text-white/65 hover:text-[#f5f0de]" : "text-slate-700 hover:text-slate-900"}`}
            >
              {showContextLog ? "Hide context" : "Show context"}
            </button>

            {showContextLog && (
              <div className="space-y-3">
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
            {loading ? (isEditMode ? "Saving..." : "Logging...") : ticketUploading ? "Uploading image..." : isEditMode ? "Save Changes" : "Log Movie"}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
