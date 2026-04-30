"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { get, ref, remove } from "firebase/database";
import { CloudDownload, Upload } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine } from "../settings-ui";
import { auth, db } from "@/lib/firebase";
import { createMovieLog } from "@/lib/logs";
import { searchMovies } from "@/lib/tmdb";
import type { MovieLog, List } from "@/types";

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseRatingsCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\ufeff/, "").toLowerCase());
  const dateIdx = headers.findIndex((h) => h === "date");
  const nameIdx = headers.findIndex((h) => h === "name" || h.includes("title"));
  const yearIdx = headers.findIndex((h) => h === "year");
  const ratingIdx = headers.findIndex((h) => h === "rating");

  if (nameIdx === -1 || ratingIdx === -1) throw new Error("CSV must include Name and Rating columns.");

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      date: dateIdx >= 0 ? cols[dateIdx] : "",
      name: cols[nameIdx] || "",
      year: yearIdx >= 0 ? cols[yearIdx] : "",
      rating: cols[ratingIdx] || "",
    };
  });
}

function parseRatingValue(ratingText: string): number | null {
  if (!ratingText) return null;
  const cleaned = ratingText.replace(",", ".").replace(/[^\d.]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 5) return null;
  return parsed;
}

function isValidDateString(dateText: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateText) && !Number.isNaN(new Date(dateText).getTime());
}

type RatingBounds = {
  badMax: number;
  masterpieceMin: number;
};

const DEFAULT_RATING_BOUNDS: RatingBounds = {
  badMax: 2.5,
  masterpieceMin: 4.5,
};

function getReactionFromRating(rating: number, bounds: RatingBounds): 0 | 1 | 2 {
  if (rating <= bounds.badMax) return 0;
  if (rating >= bounds.masterpieceMin) return 2;
  return 1;
}

function parseRatingBounds(badMaxText: string, masterpieceMinText: string): RatingBounds {
  const badMax = Number.parseFloat(badMaxText);
  const masterpieceMin = Number.parseFloat(masterpieceMinText);

  const safeBadMax = Number.isFinite(badMax) ? Math.min(Math.max(badMax, 0), 5) : DEFAULT_RATING_BOUNDS.badMax;
  const safeMasterpieceMin = Number.isFinite(masterpieceMin)
    ? Math.min(Math.max(masterpieceMin, 0), 5)
    : DEFAULT_RATING_BOUNDS.masterpieceMin;

  if (safeBadMax >= safeMasterpieceMin) {
    return DEFAULT_RATING_BOUNDS;
  }

  return {
    badMax: safeBadMax,
    masterpieceMin: safeMasterpieceMin,
  };
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user, loading, handleSignOut } = useSettingsUser();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [badMaxInput, setBadMaxInput] = useState(String(DEFAULT_RATING_BOUNDS.badMax));
  const [masterpieceMinInput, setMasterpieceMinInput] = useState(String(DEFAULT_RATING_BOUNDS.masterpieceMin));

  const handleImport = async (file: File) => {
    if (!auth.currentUser || !user) return;

    setBusy(true);
    setMessage(null);
    setError("");

    try {
      const ratingBounds = parseRatingBounds(badMaxInput, masterpieceMinInput);
      const rows = parseRatingsCsv(await file.text());
      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const title = row.name?.trim();
        const ratingValue = parseRatingValue(row.rating);
        if (!title || ratingValue === null) {
          skipped += 1;
          continue;
        }

        const targetTitle = normalizeTitle(title);
        const targetYear = row.year?.trim();
        const queryCandidates = Array.from(
          new Set(
            [targetYear ? `${title} ${targetYear}` : "", targetYear ? `${title.replace(/\(\d{4}\)\s*$/, "").trim()} ${targetYear}` : "", title, title.replace(/\(\d{4}\)\s*$/, "").trim()].filter(Boolean)
          )
        );

        const allResults: any[] = [];
        for (const query of queryCandidates) {
          const results = await searchMovies(query, 1);
          if (results.length > 0) allResults.push(...results);
        }

        const uniqueResults = Array.from(new Map(allResults.map((movie) => [movie.id, movie])).values());
        const scored = uniqueResults
          .map((movie) => {
            const movieTitle = normalizeTitle(movie.title || "");
            const movieYear = movie.release_date?.split("-")[0] || "";
            let score = 0;
            if (movieTitle === targetTitle) score += 100;
            else if (movieTitle.includes(targetTitle) || targetTitle.includes(movieTitle)) score += 50;
            if (targetYear) score = movieYear === targetYear ? score + 1000 : -1;
            return { movie, score };
          })
          .filter((entry) => entry.score >= 0)
          .sort((a, b) => b.score - a.score);

        const match = targetYear ? scored[0]?.movie || null : scored[0]?.movie || uniqueResults[0] || null;
        if (!match) {
          skipped += 1;
          continue;
        }

        const watchedDate = isValidDateString(row.date) ? row.date : new Date().toISOString().split("T")[0];
        await createMovieLog(
          auth.currentUser.uid,
          match.id,
          "movie",
          watchedDate,
          getReactionFromRating(ratingValue, ratingBounds),
          "",
          undefined,
          undefined,
          undefined,
          true
        );
        imported += 1;
      }

      setMessage(`Imported ${imported} row${imported === 1 ? "" : "s"}. Skipped ${skipped}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import CSV file.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    setMessage(null);

    try {
      const [profileSnap, logsSnap, listsSnap, followsSnap, notificationsSnap, postsSnap, sharesSnap] = await Promise.all([
        get(ref(db, `users/${user.id}`)),
        get(ref(db, "movie_logs")),
        get(ref(db, "lists")),
        get(ref(db, "follows")),
        get(ref(db, `notifications/${user.id}`)),
        get(ref(db, "cine_posts")),
        get(ref(db, "shares")),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        profile: profileSnap.exists() ? profileSnap.val() : null,
        settings: profileSnap.exists() ? profileSnap.val()?.settings || null : null,
        logs: logsSnap.exists() ? Object.entries(logsSnap.val() as Record<string, MovieLog>).filter(([, log]) => log.user_id === user.id).map(([id, log]) => ({ ...log, id })) : [],
        lists: listsSnap.exists() ? Object.entries(listsSnap.val() as Record<string, List>).filter(([, list]) => list.owner_id === user.id).map(([id, list]) => ({ ...list, id })) : [],
        follows: followsSnap.exists() ? Object.entries(followsSnap.val() as Record<string, any>).filter(([, follow]) => follow.follower_id === user.id || follow.following_id === user.id).map(([id, follow]) => ({ ...follow, id })) : [],
        notifications: notificationsSnap.exists() ? notificationsSnap.val() : null,
        cinePosts: postsSnap.exists() ? Object.entries(postsSnap.val() as Record<string, any>).filter(([, post]) => post.user_id === user.id).map(([id, post]) => ({ ...post, id })) : [],
        shares: sharesSnap.exists() ? Object.entries(sharesSnap.val() as Record<string, any>).filter(([, share]) => share.sender_id === user.id || share.receiver_id === user.id).map(([id, share]) => ({ ...share, id })) : [],
      };

      downloadJsonFile(`cineparte-${user.username}-export.json`, payload);
      setMessage("Your JSON export is ready.");
    } catch (err) {
      setError("We could not export your data right now.");
    } finally {
      setBusy(false);
    }
  };

  const handleClearImports = async () => {
    if (!user) return;
    const confirmed = window.confirm("Remove all logs imported from CSV?");
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    setError("");

    try {
      const logsSnap = await get(ref(db, "movie_logs"));
      if (!logsSnap.exists()) {
        setMessage("No imported logs found.");
        return;
      }

      const removals: Promise<void>[] = [];
      let removed = 0;
      Object.entries(logsSnap.val() as Record<string, MovieLog>).forEach(([id, log]) => {
        if (log.user_id === user.id && (log.imported_from_csv || log.notes === "Imported from ratings CSV")) {
          removals.push(remove(ref(db, `movie_logs/${id}`)));
          removed += 1;
        }
      });
      await Promise.all(removals);
      setMessage(`Removed ${removed} imported log${removed === 1 ? "" : "s"}.`);
    } catch {
      setError("Could not clear imported ratings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Import"
      description="Letterboxd CSV and data export. Keep the actions short and direct."
    >
      <div className="space-y-3">
        <SettingLine icon={Upload} title="Import Letterboxd CSV" description="Pick a ratings export and we will build logs from it.">
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#f5f0de]">Custom rating map</p>
                  <p className="mt-1 text-xs text-white/45">
                    Decide how your CSV ratings become Bad, Good, or Masterpiece before importing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBadMaxInput(String(DEFAULT_RATING_BOUNDS.badMax));
                    setMasterpieceMinInput(String(DEFAULT_RATING_BOUNDS.masterpieceMin));
                  }}
                  disabled={busy}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10 disabled:opacity-50"
                >
                  Reset
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ffb36b]/80">Bad up to</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={badMaxInput}
                    onChange={(event) => setBadMaxInput(event.target.value)}
                    disabled={busy}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b0b0b] px-3 py-2 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/60 disabled:opacity-50"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ffb36b]/80">Masterpiece from</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={masterpieceMinInput}
                    onChange={(event) => setMasterpieceMinInput(event.target.value)}
                    disabled={busy}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b0b0b] px-3 py-2 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a]/60 disabled:opacity-50"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-[#f5f0de]/70">
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  0.0 - {Number.parseFloat(badMaxInput) || DEFAULT_RATING_BOUNDS.badMax} = Bad
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  {(Number.isFinite(Number.parseFloat(badMaxInput)) ? Number.parseFloat(badMaxInput) : DEFAULT_RATING_BOUNDS.badMax) + 0.1} - {(Number.isFinite(Number.parseFloat(masterpieceMinInput)) ? Number.parseFloat(masterpieceMinInput) : DEFAULT_RATING_BOUNDS.masterpieceMin) - 0.1} = Good
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                  {Number.isFinite(Number.parseFloat(masterpieceMinInput)) ? Number.parseFloat(masterpieceMinInput) : DEFAULT_RATING_BOUNDS.masterpieceMin}+ = Masterpiece
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10 disabled:opacity-50"
              >
                Choose file
              </button>
              <button
                onClick={handleClearImports}
                disabled={busy}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10 disabled:opacity-50"
              >
                Clear imports
              </button>
            </div>
          </div>
        </SettingLine>

        <SettingLine icon={CloudDownload} title="Export data" description="Download your profile, logs, lists and social data as JSON.">
          <button
            onClick={handleExport}
            disabled={busy}
            className="rounded-full bg-[#ff7a1a] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#ff8d3b] disabled:opacity-50"
          >
            Download export
          </button>
        </SettingLine>

        {message && <p className="pt-2 text-xs text-emerald-700">{message}</p>}
        {error && <p className="pt-2 text-xs text-rose-700">{error}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleImport(file);
            }
          }}
        />
      </div>
    </SettingsPageFrame>
  );
}
