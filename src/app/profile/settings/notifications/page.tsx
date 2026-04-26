"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Bell, LoaderCircle, MessageSquare, Mail, Smartphone, Sparkles, Users } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine, CompactToggle } from "../settings-ui";
import {
  disablePushNotificationsForUser,
  enablePushNotificationsForUser,
  getPushEnrollmentState,
  type PushEnrollmentState,
} from "@/lib/push-notifications";

export default function SettingsNotificationsPage() {
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();
  const [pushState, setPushState] = useState<PushEnrollmentState>({
    supported: false,
    permission: "unsupported",
    enabled: false,
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const next = await getPushEnrollmentState();
      if (!cancelled) {
        setPushState(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const refreshPushState = async () => {
    setPushState(await getPushEnrollmentState());
  };

  const handlePushToggle = async () => {
    if (!user || pushBusy) return;

    setPushBusy(true);
    setPushMessage("");

    try {
      if (pushState.enabled) {
        await disablePushNotificationsForUser(user.id);
        await updateSection("notifications", { pushNotifications: false });
        setPushMessage("Push notifications disabled on this device.");
      } else {
        const result = await enablePushNotificationsForUser(user.id);
        if (!result.ok) {
          setPushMessage(result.message);
          return;
        }

        await updateSection("notifications", { pushNotifications: true });
        setPushMessage("Push notifications enabled on this device.");
      }

      await refreshPushState();
    } catch (error) {
      console.error("Error updating push notifications:", error);
      setPushMessage("Could not update push notifications right now.");
    } finally {
      setPushBusy(false);
    }
  };

  const pushStatusText = !pushState.supported
    ? "Not supported in this browser."
    : pushState.permission === "denied"
      ? "Notifications are blocked in browser settings."
      : pushState.enabled
        ? "Enabled on this device."
        : "Disabled on this device.";

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Notifications"
      description="Only the updates you actually want."
    >
      <div className="space-y-2">
        <SettingLine
          icon={Smartphone}
          title="Web push notifications"
          description="Get alerts on this browser or installed app."
        >
          <div className="flex flex-col items-end gap-2">
            <p className="text-right text-xs font-semibold text-white/55">{pushStatusText}</p>
            <button
              type="button"
              onClick={() => void handlePushToggle()}
              disabled={pushBusy || (!pushState.supported && !pushState.enabled)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition ${
                pushState.enabled
                  ? "bg-[#f5f0de] text-[#0a0a0a] hover:bg-white"
                  : "bg-[#ff7a1a] text-[#0a0a0a] hover:bg-[#ff8d3b]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {pushBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {pushState.enabled ? "Disable" : "Enable on this device"}
            </button>
          </div>
        </SettingLine>

        {pushMessage ? (
          <div className="flex items-start gap-2 rounded-2xl border border-[#ff7a1a]/20 bg-[#ff7a1a]/10 p-3 text-xs text-[#f5f0de]/80">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#ffb36b]" />
            <p>{pushMessage}</p>
          </div>
        ) : null}

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
