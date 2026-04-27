"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";

interface PublicListsProps {
  lists: Array<{ id: string; name: string; description: string | null; item_count?: number }>;
}

export default function PublicLists({ lists }: PublicListsProps) {
  if (lists.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="w-6 h-6 text-[#f5f0de]" />
        <h2 className="text-2xl font-bold text-gray-900">Public Lists</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.map((list) => (
          <Link key={list.id} href={`/lists/${list.id}`}>
            <div className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer h-full">
              <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                {list.name}
              </h3>
              {list.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{list.description}</p>
              )}
              <p className="text-xs text-gray-500">
                {list.item_count || 0} movies
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
