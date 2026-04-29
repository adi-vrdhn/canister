"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { CinePostWithDetails, User } from "@/types";
import { deleteCinePost, updateCinePost } from "@/lib/cineposts";
import ShareLinkButton from "@/components/ShareLinkButton";

interface CinePostOwnerMenuProps {
  post: CinePostWithDetails;
  currentUser: User | null;
  onDeleted: () => void;
  onUpdated: () => void;
  theme?: "default" | "brutalist";
}

function tagsToText(tags: string[]): string {
  return tags.map((tag) => tag.replace(/^#/, "")).join(", ");
}

function textToTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function CinePostOwnerMenu({
  post,
  currentUser,
  onDeleted,
  onUpdated,
  theme = "default",
}: CinePostOwnerMenuProps) {
  const isBrutalist = theme === "brutalist";
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [body, setBody] = useState(post.body);
  const [tags, setTags] = useState(tagsToText(post.tags || []));
  const [saving, setSaving] = useState(false);

  if (!currentUser || currentUser.id !== post.user_id) return null;

  const closeEditor = () => {
    setEditOpen(false);
    setBody(post.body);
    setTags(tagsToText(post.tags || []));
  };

  const handleEdit = async () => {
    if (body.trim().length < 2) return;

    try {
      setSaving(true);
      await updateCinePost(post.id, currentUser.id, {
        body,
        tags: textToTags(tags),
      });
      setEditOpen(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this post? This will also remove its comments.");
    if (!confirmed) return;

    await deleteCinePost(post.id, currentUser.id);
    setMenuOpen(false);
    onDeleted();
  };

  return (
    <>
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={`flex items-center justify-center p-1 transition ${
            isBrutalist ? "text-[#f5f0de] hover:text-[#ff7a1a]" : "text-[#ff7a1a] hover:text-[#ffb36b]"
          }`}
          aria-label="Post options"
          aria-expanded={menuOpen}
        >
          <MoreVertical className="h-6 w-6" />
        </button>

        {menuOpen && (
          <div
            className={`absolute right-0 top-11 z-20 w-44 overflow-hidden border p-1 shadow-xl ${
              isBrutalist ? "border-white/10 bg-[#111111] text-[#f5f0de]" : "rounded-2xl border-slate-200 bg-white"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setBody(post.body);
                setTags(tagsToText(post.tags || []));
                setEditOpen(true);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold transition ${
                isBrutalist ? "text-[#f5f0de] hover:bg-white/5" : "rounded-xl text-slate-700 hover:bg-slate-50"
              }`}
              >
              <Pencil className="h-4 w-4" />
              Edit post
            </button>
            <ShareLinkButton
              href={`/posts/${post.id}`}
              title={`${post.user.name}'s post`}
              text={`Shared from Canisterr by ${post.user.name}.`}
              showLabel
              onActivate={() => setMenuOpen(false)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold transition ${
                isBrutalist ? "text-[#f5f0de] hover:bg-white/5" : "rounded-xl text-slate-700 hover:bg-slate-50"
              }`}
              ariaLabel="Share post link"
            />
            <button
              type="button"
              onClick={handleDelete}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold transition ${
                isBrutalist ? "text-[#ff7a1a] hover:bg-white/5" : "rounded-xl text-red-600 hover:bg-red-50"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              Delete post
            </button>
          </div>
        )}
      </div>

      {editOpen && (
        <div className={`fixed inset-0 z-50 flex items-end justify-center p-3 backdrop-blur-sm sm:items-center ${
          isBrutalist ? "bg-black/75" : "bg-slate-950/45"
        }`}>
          <div
            className={`w-full max-w-lg p-4 shadow-2xl ${
              isBrutalist ? "border border-white/10 bg-[#111111] text-[#f5f0de]" : "rounded-[1.75rem] border border-slate-200 bg-white"
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className={`text-lg font-black ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>Edit post</h3>
                <p className={`text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                  Update the text and tags for this post.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className={`rounded-full border p-2 transition ${
                  isBrutalist ? "border-white/10 text-white/55 hover:bg-white/5 hover:text-[#f5f0de]" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
                aria-label="Close editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className={`text-xs font-black uppercase tracking-[0.18em] ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
              Post
            </label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              className={`mt-2 w-full resize-none border px-4 py-3 text-sm leading-6 outline-none ${
                isBrutalist
                  ? "rounded-3xl border-white/10 bg-[#0d0d0d] text-[#f5f0de] focus:border-[#ff7a1a]"
                  : "rounded-3xl border-slate-200 text-slate-800 focus:border-blue-500"
              }`}
              placeholder="Write your post..."
            />

            <label className={`mt-4 block text-xs font-black uppercase tracking-[0.18em] ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
              Tags
            </label>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className={`mt-2 w-full border px-4 py-3 text-sm outline-none ${
                isBrutalist
                  ? "rounded-full border-white/10 bg-[#0d0d0d] text-[#f5f0de] focus:border-[#ff7a1a]"
                  : "rounded-full border-slate-200 focus:border-blue-500"
              }`}
              placeholder="music, masterpiece, ending"
            />

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeEditor}
                className={`flex-1 px-4 py-3 text-sm font-black transition ${
                  isBrutalist
                    ? "rounded-full border border-white/10 text-[#f5f0de] hover:bg-white/5"
                    : "rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEdit}
                disabled={saving || body.trim().length < 2}
                className={`flex-1 px-4 py-3 text-sm font-black text-white transition disabled:opacity-50 ${
                  isBrutalist
                    ? "rounded-full bg-[#ff7a1a] hover:bg-[#ff8d3b]"
                    : "rounded-full bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
