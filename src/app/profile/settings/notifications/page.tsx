"use client";

import { Bell, Users, Sparkles, MessageSquare, Mail } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine, CompactToggle } from "../settings-ui";

export default function SettingsNotificationsPage() {
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Notifications"
      description="Only the updates you actually want."
    >
      <div className="space-y-2">
        <SettingLine icon={Users} title="Follow requests" description="Let people know when they want to follow you.">
          <CompactToggle
            checked={settings.notifications.followRequests}
            onChange={(next) => void updateSection("notifications", { followRequests: next })}
            label={settings.notifications.followRequests ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine icon={Sparkles} title="Likes and comments" description="Post and log reactions land here.">
          <CompactToggle
            checked={settings.notifications.likesAndComments}
            onChange={(next) => void updateSection("notifications", { likesAndComments: next })}
            label={settings.notifications.likesAndComments ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine icon={MessageSquare} title="Collaboration invites" description="List collaboration requests and invites.">
          <CompactToggle
            checked={settings.notifications.collaborationInvites}
            onChange={(next) => void updateSection("notifications", { collaborationInvites: next })}
            label={settings.notifications.collaborationInvites ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine icon={Bell} title="Matcher updates" description="Movie matcher and report updates.">
          <CompactToggle
            checked={settings.notifications.matcherUpdates}
            onChange={(next) => void updateSection("notifications", { matcherUpdates: next })}
            label={settings.notifications.matcherUpdates ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine icon={Mail} title="Email notifications" description="Optional email delivery for account messages.">
          <CompactToggle
            checked={settings.notifications.emailNotifications}
            onChange={(next) => void updateSection("notifications", { emailNotifications: next })}
            label={settings.notifications.emailNotifications ? "On" : "Off"}
          />
        </SettingLine>
      </div>
    </SettingsPageFrame>
  );
}
