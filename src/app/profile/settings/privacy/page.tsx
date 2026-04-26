"use client";

import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine } from "../settings-ui";
import { Shield, Eye, ListChecks, Lock, Users } from "lucide-react";

const selectClass =
  "rounded-full border border-white/10 bg-[#111111] px-3 py-1.5 text-xs font-semibold text-[#f5f0de] outline-none transition focus:border-[#ff7a1a]";

export default function SettingsPrivacyPage() {
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Privacy"
      description="Profile, list and log visibility in a few small controls."
    >
      <div className="space-y-2">
        <SettingLine icon={Shield} title="Profile visibility" description="Who can open your profile page.">
          <select
            className={selectClass}
            value={settings.privacy.profileVisibility}
            onChange={(event) => void updateSection("privacy", { profileVisibility: event.target.value as any })}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private</option>
          </select>
        </SettingLine>

        <SettingLine icon={Users} title="Follow requests" description="Who can send you a follow request.">
          <select
            className={selectClass}
            value={settings.privacy.followRequests}
            onChange={(event) => void updateSection("privacy", { followRequests: event.target.value as any })}
          >
            <option value="everyone">Everyone</option>
            <option value="followers">Followers</option>
            <option value="nobody">Nobody</option>
          </select>
        </SettingLine>

        <SettingLine icon={ListChecks} title="Lists visibility" description="Who can see your public lists and collection pages.">
          <select
            className={selectClass}
            value={settings.privacy.listVisibility}
            onChange={(event) => void updateSection("privacy", { listVisibility: event.target.value as any })}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private</option>
          </select>
        </SettingLine>

        <SettingLine icon={Eye} title="Logs visibility" description="Who can see your watched logs and activity.">
          <select
            className={selectClass}
            value={settings.privacy.logVisibility}
            onChange={(event) => void updateSection("privacy", { logVisibility: event.target.value as any })}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private</option>
          </select>
        </SettingLine>

        <SettingLine icon={Lock} title="Activity visibility" description="Who can see the activity style surfaces on your profile.">
          <select
            className={selectClass}
            value={settings.privacy.activityVisibility}
            onChange={(event) => void updateSection("privacy", { activityVisibility: event.target.value as any })}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private</option>
          </select>
        </SettingLine>
      </div>
    </SettingsPageFrame>
  );
}
