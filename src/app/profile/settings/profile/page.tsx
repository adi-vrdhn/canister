"use client";

import Link from "next/link";
import { Camera, PencilLine, UserRoundCog } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine } from "../settings-ui";

export default function SettingsProfilePage() {
  const { user, loading, handleSignOut } = useSettingsUser();

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Profile"
      description="Photo, name, username and bio. Keep it quick, small and easy to edit."
    >
      {!user ? null : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff7a1a] text-sm font-bold text-[#0a0a0a]">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#f5f0de]">{user.name}</p>
              <p className="text-xs text-white/55">@{user.username}</p>
            </div>
          </div>

          <SettingLine
            icon={Camera}
            title="Profile picture"
            description="Change your avatar from the profile editor."
          >
            <Link href="/profile/edit" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10">
              Edit avatar
            </Link>
          </SettingLine>

          <SettingLine
            icon={UserRoundCog}
            title="Name, username and bio"
            description="Update your identity and short bio in one place."
          >
            <Link href="/profile/edit" className="rounded-full bg-[#ff7a1a] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#ff8d3b]">
              Open editor
            </Link>
          </SettingLine>

          <SettingLine
            icon={PencilLine}
            title="Public profile"
            description="See the profile your followers view."
          >
            <Link href={`/profile/${user.username}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10">
              View profile
            </Link>
          </SettingLine>
        </div>
      )}
    </SettingsPageFrame>
  );
}
