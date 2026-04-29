"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clapperboard, Film, Search, Sparkles, Tv, UserRound, X } from "lucide-react";
import { CinePostAnchorType, Content, TMDBMovie, TMDBPersonSearchResult, User } from "@/types";
import { createCinePost } from "@/lib/cineposts";
import { reportAppError } from "@/lib/report-error";
import { searchMovies, searchPeople } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";

const ANCHOR_TYPES: Array<{ value: CinePostAnchorType; label: string }> = [
  { value: "movie", label: "Movie" },
  { value: "tv", label: "TV" },
  { value: "crew", label: "Crew" },
];

type AnchorResult = Content | TMDBPersonSearchResult;

function isCrewResult(item: AnchorResult): item is TMDBPersonSearchResult {
  return "profile_path" in item;
}

function anchorTypeLabel(anchorType: CinePostAnchorType): string {
  if (anchorType === "movie") return "movie";
  if (anchorType === "tv") return "TV show";
  return "crew member";
}

function anchorSearchLabel(anchorType: CinePostAnchorType): string {
  if (anchorType === "movie") return "TMDB movies";
  if (anchorType === "tv") return "TV shows";
  return "TMDB people";
}

function anchorPlaceholder(anchorType: CinePostAnchorType): string {
  if (anchorType === "movie") return "Search La La Land, The Dark Knight...";
  if (anchorType === "tv") return "Search Ted Lasso, Breaking Bad...";
  return "Search Brad Pitt, Christopher Nolan...";
}

interface CinePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onCreated?: (message: string) => void;
  theme?: "default" | "brutalist";
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

export default function CinePostModal({ isOpen, onClose, user, onCreated, theme = "default" }: CinePostModalProps) {
  const isBrutalist = theme === "brutalist";
  const [anchorType, setAnchorType] = useState<CinePostAnchorType>("movie");
  const [anchorQuery, setAnchorQuery] = useState("");
  const [anchorResults, setAnchorResults] = useState<AnchorResult[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<TMDBPersonSearchResult | null>(null);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const query = anchorQuery.trim();
    if (query.length < 1 || selectedContent || selectedPerson) {
      setAnchorResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        const results: AnchorResult[] =
          anchorType === "movie"
            ? (await searchMovies(query, 1)).slice(0, 8).map(movieToContent)
            : anchorType === "tv"
              ? ((await searchShows(query)).slice(0, 8) as unknown as Content[])
              : await searchPeople(query);

        if (!cancelled) {
          setAnchorResults(results);
        }
      } catch (err) {
        reportAppError({
          title: "Post search failed",
          message: "We could not load suggestions for this post.",
          details: err instanceof Error ? err.stack || err.message : String(err),
        });
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
  }, [anchorQuery, anchorType, isOpen, selectedContent, selectedPerson]);

  if (!isOpen) return null;

  const resetAnchor = (nextType: CinePostAnchorType) => {
    setAnchorType(nextType);
    setAnchorQuery("");
    setAnchorResults([]);
    setSelectedContent(null);
    setSelectedPerson(null);
    setError("");
  };

  const handleSelectContent = (item: Content) => {
    setSelectedContent(item);
    setAnchorQuery(item.title || (item as any).name || "");
    setAnchorResults([]);
    setSelectedPerson(null);
    setError("");
  };

  const handleSelectPerson = (person: TMDBPersonSearchResult) => {
    setSelectedPerson(person);
    setAnchorQuery(person.name);
    setAnchorResults([]);
    setSelectedContent(null);
    setError("");
  };

  const handleSelectSearchResult = (item: AnchorResult) => {
    if (isCrewResult(item)) {
      handleSelectPerson(item);
      return;
    }

    handleSelectContent(item);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (content.trim().length < 8) {
      setError("Write a little more so people have something to reply to.");
      return;
    }

    if (anchorType === "crew") {
      if (!selectedPerson) {
        setError("Select a crew member from search first.");
        return;
      }
    } else if (!selectedContent) {
      setError(`Select a ${anchorTypeLabel(anchorType)} from search first.`);
      return;
    }

    try {
      setSaving(true);
      setError("");
      if (anchorType === "crew") {
        const person = selectedPerson;
        if (!person) return;

        await createCinePost({
          user,
          type: "post",
          anchorType,
          anchorLabel: person.name,
          body: content,
          tags: tags.split(","),
          content: null,
          personId: person.id,
          personName: person.name,
          personProfileUrl: person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : null,
          personDepartment: person.known_for_department || null,
        });
      } else {
        await createCinePost({
          user,
          type: "post",
          anchorType,
          anchorLabel: selectedContent?.title || (selectedContent as any)?.name || "Untitled",
          body: content,
          tags: tags.split(","),
          content: selectedContent,
        });
      }
      setAnchorType("movie");
      setAnchorQuery("");
      setAnchorResults([]);
      setSelectedContent(null);
      setSelectedPerson(null);
      setContent("");
      setTags("");
      const successMessage =
        anchorType === "tv"
          ? "TV show posted"
          : anchorType === "movie"
            ? "Movie posted"
            : "Post created";
      onCreated?.(successMessage);
      onClose();
    } catch (err) {
      reportAppError({
        title: "Post creation failed",
        message: "We could not publish this post.",
        details: err instanceof Error ? err.stack || err.message : String(err),
      });
      setError("Could not create this post. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-2 backdrop-blur-md sm:items-center sm:p-6">
      <div className={`max-h-[92dvh] w-full max-w-[42rem] overflow-y-auto border shadow-[0_30px_120px_rgba(0,0,0,0.45)] ${
        isBrutalist ? "border-white/10 bg-[#111111] text-[#f5f0de]" : "rounded-[2rem] border-slate-200 bg-[#fcfcfb]"
      }`}>
        <div className={`sticky top-0 z-10 flex items-start justify-between gap-4 border-b p-4 backdrop-blur-xl sm:p-6 ${
          isBrutalist ? "border-white/10 bg-[#111111]/95" : "border-slate-200/80 bg-[#fcfcfb]/90"
        }`}>
          <div className="min-w-0">
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] ${
              isBrutalist ? "border-white/10 text-white/60" : "border-slate-200 bg-white text-slate-500"
            }`}>
              <Sparkles className="h-3.5 w-3.5" />
              Post
            </div>
            <h2 className={`text-[1.9rem] font-black leading-none tracking-tight sm:text-[2.35rem] ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>Start a cinema thread</h2>
            <p className={`mt-2 max-w-xl text-sm leading-6 sm:text-[15px] ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>Pick a title or crew member, then write your take. Everything stays compact, clean, and easy to scan.</p>
          </div>
          <button
            type="button"
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border transition ${
              isBrutalist
                ? "border-white/10 text-white/60 hover:bg-white/5 hover:text-[#f5f0de]"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            }`}
            onClick={onClose}
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:space-y-5 sm:p-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ANCHOR_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => resetAnchor(type.value)}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-3 text-center text-[13px] font-semibold leading-none transition sm:min-h-12 sm:px-4 sm:text-sm ${
                  anchorType === type.value
                    ? "bg-[#ff7a1a] text-black shadow-[0_10px_30px_rgba(255,122,26,0.25)]"
                    : isBrutalist
                      ? "bg-white/[0.02] text-white/75 hover:bg-white/[0.05] hover:text-[#f5f0de]"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                }`}
                >
                  {type.value === "movie" ? (
                    <Film className="h-4 w-4" />
                  ) : type.value === "tv" ? (
                    <Tv className="h-4 w-4" />
                  ) : (
                    <UserRound className="h-4 w-4" />
                  )}
                  {type.label}
                </button>
              ))}
          </div>

          <div>
            <label className={`mb-1 block text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>
              Search {anchorSearchLabel(anchorType)}
            </label>
            <div className="relative">
              <Search className={`pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ${isBrutalist ? "text-white/35" : "text-slate-400"}`} />
              <input
                className={`field py-3 pl-10 ${
                  isBrutalist ? "border-white/10 bg-[#0d0d0d] text-[#f5f0de]" : "bg-white"
                }`}
                placeholder={anchorPlaceholder(anchorType)}
                value={anchorQuery}
                onChange={(event) => {
                  setAnchorQuery(event.target.value);
                  setSelectedContent(null);
                  setSelectedPerson(null);
                }}
              />
              {searching && (
                <span
                  className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 ${
                    isBrutalist ? "border-white/20 border-t-[#ff7a1a]" : "border-slate-300 border-t-[#ff7a1a]"
                  }`}
                />
              )}
            </div>

            {anchorResults.length > 0 && (
              <div className={`mt-2 max-h-72 overflow-y-auto rounded-2xl shadow-xl ${
                isBrutalist ? "border border-white/10 bg-[#0d0d0d]" : "border border-slate-200 bg-white"
              }`}>
                {anchorResults.map((item) => (
                  <button
                    key={`${isCrewResult(item) ? "crew" : item.type || anchorType}-${item.id}`}
                    type="button"
                    onClick={() => handleSelectSearchResult(item)}
                    className={`flex w-full items-center gap-3 border-b p-3 text-left transition last:border-b-0 ${
                      isBrutalist
                        ? "border-white/10 hover:bg-white/[0.04]"
                        : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    {isCrewResult(item) ? (
                      item.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${item.profile_path}`}
                          alt={item.name}
                          className="h-16 w-12 flex-shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <UserRound className="h-5 w-5" />
                        </div>
                      )
                    ) : item.poster_url ? (
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
                      <p className={`truncate text-sm font-black ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>
                        {isCrewResult(item) ? item.name : item.title}
                      </p>
                      <p className={`text-xs ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                        {isCrewResult(item)
                          ? item.known_for_department || "TMDB person"
                          : item.release_date
                            ? item.release_date.slice(0, 4)
                            : "Unknown year"}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 font-bold uppercase ${
                            isBrutalist ? "bg-white/10 text-[#f5f0de]" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isCrewResult(item) ? "crew" : anchorType}
                        </span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {(selectedContent || selectedPerson) && (
              <div className="mt-3 flex items-center gap-3 rounded-3xl border border-[#ff7a1a]/25 bg-[#ff7a1a]/10 p-3">
                {selectedPerson ? (
                  selectedPerson.profile_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${selectedPerson.profile_path}`}
                      alt={selectedPerson.name}
                      className="h-20 w-14 rounded-xl object-cover shadow-sm"
                    />
                  ) : (
                    <div className="h-20 w-14 rounded-xl bg-white/5" />
                  )
                ) : selectedContent?.poster_url ? (
                  <img
                    src={selectedContent.poster_url}
                    alt={selectedContent.title}
                    className="h-20 w-14 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="h-20 w-14 rounded-xl bg-white" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#ff7a1a] px-2 py-1 text-[11px] font-bold uppercase text-black">
                    <CheckCircle2 className="h-3 w-3" />
                    selected
                  </div>
                  <p className="truncate font-black text-[#f5f0de]">
                    {selectedPerson ? selectedPerson.name : selectedContent?.title}
                  </p>
                  <p className="text-xs text-white/55">
                    {selectedPerson
                      ? "This person will become the tap target on the post."
                      : "This poster will become the tap target on the post."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className={`rounded-3xl border p-4 ${isBrutalist ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50"}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className={`text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Post details</label>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${isBrutalist ? "bg-white/5 text-white/55" : "bg-white text-slate-500"}`}>
                Post
              </span>
            </div>
            <textarea
              className={`min-h-36 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none transition focus:ring-4 ${
                isBrutalist
                  ? "border-white/10 bg-[#0d0d0d] text-[#f5f0de] focus:border-white/20 focus:ring-white/10"
                  : "border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-slate-100"
              }`}
              placeholder="Write the take. Links are supported, and people can reply in threads."
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>

          <div>
            <label className={`mb-1 block text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Tags</label>
            <input
              className="field py-3"
              placeholder="cinematography, ending explained, comfort watch"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
            <p className={`mt-1 flex items-center gap-1.5 text-xs ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
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
