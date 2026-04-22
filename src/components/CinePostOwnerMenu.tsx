"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { CinePostWithDetails, User } from "@/types";
import { deleteCinePost, updateCinePost } from "@/lib/cineposts";

interface CinePostOwnerMenuProps {
  post: CinePostWithDetails;
  currentUser: User | null;
  onDeleted: () => void;
  onUpdated: () => void;
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
}: CinePostOwnerMenuProps) {
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
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          aria-label="Post options"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setBody(post.body);
                setTags(tagsToText(post.tags || []));
                setEditOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit post
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete post
            </button>
          </div>
        )}
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Edit post</h3>
                <p className="text-sm text-slate-500">Update the text and tags for this post.</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                aria-label="Close editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Post
            </label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              className="mt-2 w-full resize-none rounded-3xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-blue-500"
              placeholder="Write your post..."
            />

            <label className="mt-4 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Tags
            </label>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="mt-2 w-full rounded-full border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              placeholder="music, masterpiece, ending"
            />

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeEditor}
                className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEdit}
                disabled={saving || body.trim().length < 2}
                className="flex-1 rounded-full bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
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
