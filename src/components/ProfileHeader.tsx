"use client";

import { User } from "@/types";
import Link from "next/link";

interface ProfileHeaderProps {
  user: User;
  movieCount: number;
  followerCount: number;
  followingCount: number;
  isOwnProfile: boolean;
}

export default function ProfileHeader({
  user,
  movieCount,
  followerCount,
  followingCount,
  isOwnProfile,
}: ProfileHeaderProps) {
  return (
    <div className="surface mb-8 p-8">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex gap-6">
          {/* Avatar */}
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-3xl font-bold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="mb-1 text-4xl font-bold font-playfair text-slate-900">{user.name}</h1>

            {user.bio && <p className="mb-3 text-slate-700">{user.bio}</p>}

            {/* Mood Tags */}
            {user.mood_tags && user.mood_tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="text-xs font-medium text-slate-500">Currently into:</span>
                {user.mood_tags.map((tag) => (
                  <span
                    key={tag}
                    className="chip text-xs font-semibold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Email removed for privacy */}
          </div>
        </div>

        {/* Edit Button */}
        {isOwnProfile && (
          <Link
            href="/profile/edit"
            className="action-primary"
          >
            Edit
          </Link>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{movieCount}</p>
          <p className="text-sm text-slate-500">Movies Logged</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{followerCount}</p>
          <p className="text-sm text-slate-500">Followers</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{followingCount}</p>
          <p className="text-sm text-slate-500">Following</p>
        </div>
      </div>
    </div>
  );
}
