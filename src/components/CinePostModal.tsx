"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clapperboard, Film, Search, Sparkles, Tv, X } from "lucide-react";
import { CinePostAnchorType, CinePostType, Content, TMDBMovie, User } from "@/types";
import { createCinePost } from "@/lib/cineposts";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";

const POST_TYPES: Array<{ value: CinePostType; label: string; hint: string }> = [
  { value: "trivia", label: "Trivia", hint: "A surprising fact or detail." },
  { value: "theory", label: "Theory", hint: "A fan idea people can debate." },
  { value: "analysis", label: "Analysis", hint: "A deeper read on craft or meaning." },
  { value: "opinion", label: "Opinion", hint: "Your take, hot or thoughtful." },
];

const ANCHOR_TYPES: Array<{ value: CinePostAnchorType; label: string }> = [
  { value: "movie", label: "Movie" },
  { value: "tv", label: "TV" },
];

interface CinePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onCreated?: () => void;
}

function movieToContent(movie: TMDBMovie): Content {
  return {
    id: movie.id,
    title: movie.title,
    poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    genres: [],
    platforms: [],
    director: movie.director || null,
    actors: [],
    language: null,
    release_date: movie.release_date || null,
    overview: movie.overview || null,
    runtime: movie.runtime || null,
    rating: movie.vote_average || null,
    created_at: new Date().toISOString(),
    type: "movie",
  };
}

export default function CinePostModal({ isOpen, onClose, user, onCreated }: CinePostModalProps) {
  const [anchorType, setAnchorType] = useState<CinePostAnchorType>("movie");
  const [postType, setPostType] = useState<CinePostType>("opinion");
  const [anchorQuery, setAnchorQuery] = useState("");
  const [anchorResults, setAnchorResults] = useState<Content[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const query = anchorQuery.trim();
    if (query.length < 2 || selectedContent) {
      setAnchorResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        const results =
          anchorType === "movie"
            ? (await searchMovies(query, 1)).slice(0, 8).map(movieToContent)
            : ((await searchShows(query)).slice(0, 8) as unknown as Content[]);

        if (!cancelled) {
          setAnchorResults(results);
        }
      } catch (err) {
        console.error("Post anchor search failed:", err);
        if (!cancelled) {
          setAnchorResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [anchorQuery, anchorType, isOpen, selectedContent]);

  if (!isOpen) return null;

  const selectedType = POST_TYPES.find((type) => type.value === postType);

  const resetAnchor = (nextType: CinePostAnchorType) => {
    setAnchorType(nextType);
    setAnchorQuery("");
    setAnchorResults([]);
    setSelectedContent(null);
    setError("");
  };

  const handleSelectContent = (item: Content) => {
    setSelectedContent(item);
    setAnchorQuery(item.title || (item as any).name || "");
    setAnchorResults([]);
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (!selectedContent) {
      setError(`Select a ${anchorType === "movie" ? "movie" : "TV show"} from search first.`);
      return;
    }

    if (content.trim().length < 8) {
      setError("Write a little more so people have something to reply to.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await createCinePost({
        user,
        type: postType,
        anchorType,
        anchorLabel: selectedContent.title || (selectedContent as any).name || "Untitled",
        body: content,
        tags: tags.split(","),
        content: selectedContent,
      });
      setAnchorType("movie");
      setPostType("opinion");
      setAnchorQuery("");
      setAnchorResults([]);
      setSelectedContent(null);
      setContent("");
      setTags("");
      onCreated?.();
      onClose();
    } catch (err) {
      console.error("Error creating post:", err);
      setError("Could not create this post. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-2 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-4 backdrop-blur sm:p-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              Post
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">Start a cinema thread</h2>
            <p className="mt-1 text-sm text-slate-500">Pick a movie or TV show first, then write the take.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
            onClick={onClose}
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {ANCHOR_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => resetAnchor(type.value)}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition ${
                  anchorType === type.value
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {type.value === "movie" ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                {type.label}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-900">
              Search {anchorType === "movie" ? "TMDB movies" : "TV shows"}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="field py-3 pl-10"
                placeholder={anchorType === "movie" ? "Search La La Land, The Dark Knight..." : "Search Ted Lasso, Breaking Bad..."}
                value={anchorQuery}
                onChange={(event) => {
                  setAnchorQuery(event.target.value);
                  setSelectedContent(null);
                }}
              />
              {searching && (
                <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              )}
            </div>

            {anchorResults.length > 0 && (
              <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                {anchorResults.map((item) => (
                  <button
                    key={`${item.type || anchorType}-${item.id}`}
                    type="button"
                    onClick={() => handleSelectContent(item)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left transition last:border-b-0 hover:bg-slate-50"
                  >
                    {item.poster_url ? (
                      <img
                        src={item.poster_url}
                        alt={item.title}
                        className="h-16 w-12 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        {anchorType === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {item.release_date ? item.release_date.slice(0, 4) : "Unknown year"}
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 font-bold uppercase">
                          {anchorType}
                        </span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedContent && (
              <div className="mt-3 flex items-center gap-3 rounded-3xl border border-blue-100 bg-blue-50 p-3">
                {selectedContent.poster_url ? (
                  <img
                    src={selectedContent.poster_url}
                    alt={selectedContent.title}
                    className="h-20 w-14 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="h-20 w-14 rounded-xl bg-white" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold uppercase text-blue-700">
                    <CheckCircle2 className="h-3 w-3" />
                    selected
                  </div>
                  <p className="truncate font-black text-slate-950">{selectedContent.title}</p>
                  <p className="text-xs text-slate-500">
                    This poster will become the tap target on the post.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {POST_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setPostType(type.value)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  postType === type.value
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="block text-sm font-bold">{type.label}</span>
                <span className={`mt-1 block text-[11px] ${postType === type.value ? "text-white/65" : "text-slate-400"}`}>
                  {type.hint}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-900">Post details</label>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                {selectedType?.label}
              </span>
            </div>
            <textarea
              className="min-h-36 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              placeholder="Write the take. Links are supported, and people can reply in threads."
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-900">Tags</label>
            <input
              className="field py-3"
              placeholder="cinematography, ending explained, comfort watch"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Clapperboard className="h-3.5 w-3.5" />
              Movie or TV tags are added automatically from your selected anchor.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || !user}
            className="action-primary w-full disabled:opacity-60"
          >
            {saving ? "Posting..." : "Publish Post"}
          </button>
        </form>
      </div>
    </div>
  );
}
