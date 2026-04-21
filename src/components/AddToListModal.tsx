"use client";

import { useState, useEffect } from "react";
import { User, List, Content } from "@/types";
import { getUserLists, addItemToList, isItemInList } from "@/lib/lists";
import { Loader2 } from "lucide-react";

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Content | null;
  user: User | null;
}

export default function AddToListModal({ isOpen, onClose, content, user }: AddToListModalProps) {
  // Ripple effect handler
  function handleRipple(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const button = e.currentTarget;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${e.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add("ripple");
    button.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  }
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addedToLists, setAddedToLists] = useState<Set<string>>(new Set());
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchLists();
    }
  }, [isOpen, user]);

  const fetchLists = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userLists = await getUserLists(user.id);
      setLists(userLists);

      // Check which lists already have this item
      if (content) {
        const alreadyIn = new Set<string>();
        for (const list of userLists) {
          const exists = await isItemInList(list.id, content.id, content.type || "movie");
          if (exists) {
            alreadyIn.add(list.id);
          }
        }
        setAddedToLists(alreadyIn);
      }
    } catch (error) {
      console.error("Error fetching lists:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToList = async (listId: string) => {
    if (!user || !content) return;

    try {
      setAddingTo(listId);
      await addItemToList(listId, content.id, content.type || "movie", user.id);
      setAddedToLists(new Set([...addedToLists, listId]));
    } catch (error) {
      console.error("Error adding to list:", error);
      alert("Failed to add to list. It might already be there.");
    } finally {
      setAddingTo(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!user || !content || !newListName.trim()) return;

    try {
      setCreatingList(true);
      // TODO: Create new list and add item in one go
      // This would be a new function in lists.ts
    } catch (error) {
      console.error("Error creating list:", error);
      alert("Failed to create list");
    } finally {
      setCreatingList(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="surface-strong flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-[1.5rem] sm:max-h-[80vh] sm:rounded-[2rem]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
          <h2 className="min-w-0 text-base font-semibold text-slate-900 sm:text-lg">
            Add "{content?.title}" to a list
          </h2>
          <button
            onClick={onClose}
            className="action"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
              <p className="text-slate-500">Loading lists...</p>
            </div>
          ) : lists.length > 0 ? (
            <div className="space-y-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => handleAddToList(list.id)}
                  disabled={addingTo === list.id}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 transition-all sm:p-4 ${
                    addedToLists.has(list.id)
                      ? "border-slate-300 bg-slate-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="min-w-0 text-left">
                    <p className="font-medium text-slate-900">{list.name}</p>
                    <p className="truncate text-xs text-slate-500">{list.description || "No description"}</p>
                  </div>

                  {addingTo === list.id ? (
                    <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-slate-600" />
                  ) : addedToLists.has(list.id) ? (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">Added</span>
                  ) : (
                    <span className="text-sm font-medium text-slate-500">Add</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="mb-4 text-slate-500">You haven't created any lists yet</p>
              <button
                className="action-primary"
                onClick={e => { handleRipple(e); setShowCreateNew(true); }}
              >
                Create your first list
              </button>
            </div>
          )}

          {/* Create New List Section */}
          {showCreateNew && lists.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-900">Create a new list</p>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name..."
                className="field mb-2 py-2 text-sm"
              />
              <button
                disabled={creatingList || !newListName.trim()}
                className="action-primary w-full disabled:opacity-50"
                onClick={e => { handleRipple(e); handleCreateAndAdd(); }}
              >
                {creatingList ? "Creating..." : "Create & Add"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4">
          <button
            className="action w-full"
            onClick={e => { handleRipple(e); onClose(); }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
