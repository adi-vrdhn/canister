"use client";

import { useState, useEffect } from "react";
import { User, List } from "@/types";
import { getUserLists, getListCoverImages } from "@/lib/lists";
import { Plus, Loader2 } from "lucide-react";
import Link from "next/link";

interface ListsSidebarProps {
  user: User;
  onCreateClick?: () => void;
}

export default function ListsSidebar({ user, onCreateClick }: ListsSidebarProps) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [listCovers, setListCovers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const userLists = await getUserLists(user.id);
        setLists(userLists);

        // Fetch covers for each list
        const covers: Record<string, string[]> = {};
        for (const list of userLists) {
          covers[list.id] = await getListCoverImages(list.id);
        }
        setListCovers(covers);
      } catch (error) {
        console.error("Error fetching lists:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, [user.id]);

  if (loading) {
    return (
      <div className="p-4 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#f5f0de]" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4">
        <h3 className="font-bold text-gray-900">Lists</h3>
        <button
          onClick={onCreateClick}
          className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
          title="Create list"
        >
          <Plus className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Lists */}
      <div className="space-y-2 px-2">
        {lists.length > 0 ? (
          lists.map((list) => (
            <Link key={list.id} href={`/lists/${list.id}`}>
              <div className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors group">
                {/* List Cover Thumbnail */}
                <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-gray-200 to-gray-300 rounded overflow-hidden">
                  {listCovers[list.id] && listCovers[list.id].length > 0 ? (
                    <div className="w-full h-full grid grid-cols-2">
                      {listCovers[list.id].slice(0, 4).map((url, idx) => (
                        <div key={idx} className="w-full h-full overflow-hidden">
                          <img
                            src={url}
                            alt={`Cover ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500" />
                  )}
                </div>

                {/* List Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#f5f0de]">
                    {list.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {list.description ? list.description.substring(0, 20) + (list.description.length > 20 ? "..." : "") : "No description"}
                  </p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-xs text-gray-500 p-2 text-center">No lists yet</p>
        )}
      </div>

      {/* View All Lists Link */}
      <Link href="/lists" className="block px-4 py-2 mt-4 text-sm text-[#f5f0de] hover:text-[#f5f0de] font-medium">
        View all lists →
      </Link>
    </div>
  );
}
