"use client";

import { User } from "@/types";
import Image from "next/image";

interface UserCardProps {
  user: User;
  badge?: "following" | "pending" | "friend";
  onAction?: () => void;
  actionLabel?: string;
  showSubtitle?: boolean;
}

export default function UserCard({
  user,
  badge,
  onAction,
  actionLabel = "Follow",
  showSubtitle = false,
}: UserCardProps) {
  const badges = {
    following: { bg: "bg-blue-100", text: "text-blue-700", label: "Following" },
    pending: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" },
    friend: { bg: "bg-green-100", text: "text-green-700", label: "Friends" },
  };

  const badgeStyle = badge ? badges[badge] : null;

  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.username}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
            {user.username[0].toUpperCase()}
          </div>
        )}

        <div>
          <p className="text-base font-bold font-playfair text-gray-900">{user.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {badgeStyle && (
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${badgeStyle.bg} ${badgeStyle.text}`}
          >
            {badgeStyle.label}
          </span>
        )}

        {onAction && !badge && (
          <button
            onClick={onAction}
            className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {actionLabel}
          </button>
        )}

        {onAction && badge === "pending" && (
          <button
            onClick={onAction}
            className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Accept
          </button>
        )}
      </div>
    </div>
  );
}
