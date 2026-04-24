"use client";

import { useState } from "react";
import { Ban, Users, Eye, Share2, Trash2 } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser, normalizeUsername } from "../settings-shared";
import { SettingLine, CompactToggle } from "../settings-ui";

export default function SettingsSocialPage() {
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();
  const [blockedUserInput, setBlockedUserInput] = useState("");

  const addBlockedUser = async () => {
    const username = normalizeUsername(blockedUserInput);
    if (!username) return;
    if (settings.social.blockedUsers.includes(username)) {
      setBlockedUserInput("");
      return;
    }
    await updateSection("social", { blockedUsers: [...settings.social.blockedUsers, username] });
    setBlockedUserInput("");
  };

  const removeBlockedUser = async (username: string) => {
    await updateSection("social", {
      blockedUsers: settings.social.blockedUsers.filter((entry) => entry !== username),
    });
  };

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Social"
      description="A few switches and a tiny blocklist."
    >
      <div className="space-y-2">
        <SettingLine icon={Share2} title="Share lists publicly" description="Let public lists appear in discovery and profiles.">
          <CompactToggle
            checked={settings.social.shareListsPublicly}
            onChange={(next) => void updateSection("social", { shareListsPublicly: next })}
            label={settings.social.shareListsPublicly ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine icon={Eye} title="Show shared movies" description="Keep the shared movies tab visible on your profile.">
          <CompactToggle
            checked={settings.social.showSharedMovies}
            onChange={(next) => void updateSection("social", { showSharedMovies: next })}
            label={settings.social.showSharedMovies ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine icon={Users} title="Allow collaborations" description="Let people add you to list collaboration projects.">
          <CompactToggle
            checked={settings.social.allowCollaborations}
            onChange={(next) => void updateSection("social", { allowCollaborations: next })}
            label={settings.social.allowCollaborations ? "On" : "Off"}
          />
        </SettingLine>

        <div className="border-b border-slate-200 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
              <Ban className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-950">Blocked users</p>
              <p className="text-xs text-slate-500">Keep usernames here if you want them out of the way.</p>

              <div className="mt-2 flex flex-wrap gap-2">
                {settings.social.blockedUsers.map((username) => (
                  <span key={username} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                    @{username}
                    <button type="button" onClick={() => void removeBlockedUser(username)} className="text-slate-400 transition hover:text-rose-600" aria-label={`Remove ${username}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={blockedUserInput}
                  onChange={(event) => setBlockedUserInput(event.target.value)}
                  placeholder="username"
                  className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => void addBlockedUser()}
                  className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsPageFrame>
  );
}
