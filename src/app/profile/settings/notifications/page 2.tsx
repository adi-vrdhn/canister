"use client";

import { Bell, Users, Sparkles, MessageSquare, Mail, SendHorizontal } from "lucide-react";
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

        <SettingLine icon={Sparkles} title="Like notifications" description="Likes and saves on your posts, logs, and comments.">
          <CompactToggle
            checked={settings.notifications.likeNotifications}
            onChange={(next) => void updateSection("notifications", { likeNotifications: next })}
            label={settings.notifications.likeNotifications ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine icon={MessageSquare} title="Comment notifications" description="Comments and replies on your posts, logs, and shares.">
          <CompactToggle
            checked={settings.notifications.commentNotifications}
            onChange={(next) => void updateSection("notifications", { commentNotifications: next })}
            label={settings.notifications.commentNotifications ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine icon={SendHorizontal} title="Share notifications" description="When someone sends you a movie or TV recommendation.">
          <CompactToggle
            checked={settings.notifications.shareNotifications}
            onChange={(next) => void updateSection("notifications", { shareNotifications: next })}
            label={settings.notifications.shareNotifications ? "On" : "Off"}
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
