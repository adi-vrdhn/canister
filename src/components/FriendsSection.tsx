"use client";

interface FriendsSectionProps {
  followerCount: number;
  followingCount: number;
}

export default function FriendsSection({ followerCount, followingCount }: FriendsSectionProps) {
  return (
    <div className="surface flex gap-8 p-6">
      <div className="text-center w-full flex flex-col items-center">
        <p className="text-lg font-semibold text-slate-900">
          {followingCount} following {followerCount} followers
        </p>
      </div>
    </div>
  );
}
