import { get, ref } from "firebase/database";
import { db } from "@/lib/firebase";

export type ThemePreference = "system" | "light" | "dark";
export type TextSizePreference = "compact" | "comfortable" | "large";
export type VisibilityPreference = "public" | "followers" | "private";
export type FollowPreference = "everyone" | "followers" | "nobody";

export interface SettingsData {
  privacy: {
    profileVisibility: VisibilityPreference;
    followRequests: FollowPreference;
    listVisibility: VisibilityPreference;
    logVisibility: VisibilityPreference;
    activityVisibility: VisibilityPreference;
  };
  notifications: {
    followRequests: boolean;
    likeNotifications: boolean;
    commentNotifications: boolean;
    shareNotifications: boolean;
    collaborationInvites: boolean;
    matcherUpdates: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  appearance: {
    theme: ThemePreference;
    textSize: TextSizePreference;
    reduceMotion: boolean;
  };
  social: {
    shareListsPublicly: boolean;
    showSharedMovies: boolean;
    allowCollaborations: boolean;
    blockedUsers: string[];
  };
  account: {
    status: "active" | "deactivated";
  };
}

export const DEFAULT_SETTINGS: SettingsData = {
  privacy: {
    profileVisibility: "public",
    followRequests: "everyone",
    listVisibility: "public",
    logVisibility: "public",
    activityVisibility: "public",
  },
  notifications: {
    followRequests: true,
    likeNotifications: true,
    commentNotifications: true,
    shareNotifications: true,
    collaborationInvites: true,
    matcherUpdates: true,
    emailNotifications: false,
    pushNotifications: false,
  },
  appearance: {
    theme: "system",
    textSize: "comfortable",
    reduceMotion: false,
  },
  social: {
    shareListsPublicly: true,
    showSharedMovies: true,
    allowCollaborations: true,
    blockedUsers: [],
  },
  account: {
    status: "active",
  },
};

export function mergeSettings(raw: any): SettingsData {
  const legacyLikesAndComments = raw?.notifications?.likesAndComments;

  return {
    privacy: {
      profileVisibility: raw?.privacy?.profileVisibility || DEFAULT_SETTINGS.privacy.profileVisibility,
      followRequests: raw?.privacy?.followRequests || DEFAULT_SETTINGS.privacy.followRequests,
      listVisibility: raw?.privacy?.listVisibility || DEFAULT_SETTINGS.privacy.listVisibility,
      logVisibility: raw?.privacy?.logVisibility || DEFAULT_SETTINGS.privacy.logVisibility,
      activityVisibility: raw?.privacy?.activityVisibility || DEFAULT_SETTINGS.privacy.activityVisibility,
    },
    notifications: {
      followRequests: raw?.notifications?.followRequests ?? DEFAULT_SETTINGS.notifications.followRequests,
      likeNotifications: raw?.notifications?.likeNotifications ?? legacyLikesAndComments ?? DEFAULT_SETTINGS.notifications.likeNotifications,
      commentNotifications:
        raw?.notifications?.commentNotifications ?? legacyLikesAndComments ?? DEFAULT_SETTINGS.notifications.commentNotifications,
      shareNotifications: raw?.notifications?.shareNotifications ?? DEFAULT_SETTINGS.notifications.shareNotifications,
      collaborationInvites: raw?.notifications?.collaborationInvites ?? DEFAULT_SETTINGS.notifications.collaborationInvites,
      matcherUpdates: raw?.notifications?.matcherUpdates ?? DEFAULT_SETTINGS.notifications.matcherUpdates,
      emailNotifications: raw?.notifications?.emailNotifications ?? DEFAULT_SETTINGS.notifications.emailNotifications,
      pushNotifications: raw?.notifications?.pushNotifications ?? DEFAULT_SETTINGS.notifications.pushNotifications,
    },
    appearance: {
      theme: raw?.appearance?.theme || DEFAULT_SETTINGS.appearance.theme,
      textSize: raw?.appearance?.textSize || DEFAULT_SETTINGS.appearance.textSize,
      reduceMotion: raw?.appearance?.reduceMotion ?? DEFAULT_SETTINGS.appearance.reduceMotion,
    },
    social: {
      shareListsPublicly: raw?.social?.shareListsPublicly ?? DEFAULT_SETTINGS.social.shareListsPublicly,
      showSharedMovies: raw?.social?.showSharedMovies ?? DEFAULT_SETTINGS.social.showSharedMovies,
      allowCollaborations: raw?.social?.allowCollaborations ?? DEFAULT_SETTINGS.social.allowCollaborations,
      blockedUsers: Array.isArray(raw?.social?.blockedUsers) ? raw.social.blockedUsers : DEFAULT_SETTINGS.social.blockedUsers,
    },
    account: {
      status: raw?.account?.status === "deactivated" ? "deactivated" : "active",
    },
  };
}

export function getSettingsFromUserRecord(rawUser: any): SettingsData {
  return mergeSettings(rawUser?.settings);
}

export function normalizeUsername(value: string | null | undefined) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function resolveThemePreference(theme: ThemePreference): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";

  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function isUsernameBlocked(
  settings: SettingsData | null | undefined,
  username: string | null | undefined
): boolean {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;
  return Boolean(settings?.social.blockedUsers.some((blockedUser) => normalizeUsername(blockedUser) === normalized));
}

export function canReceiveFollowRequest(
  targetSettings: SettingsData | null | undefined,
  viewerIsAlreadyFollowing: boolean
): boolean {
  const policy = targetSettings?.privacy.followRequests || DEFAULT_SETTINGS.privacy.followRequests;

  if (policy === "everyone") return true;
  if (policy === "followers") return viewerIsAlreadyFollowing;
  return false;
}

export function canViewProfileSurface(
  targetSettings: SettingsData | null | undefined,
  viewerIsOwner: boolean,
  viewerIsFollowing: boolean
): boolean {
  if (viewerIsOwner) return true;

  const visibility = targetSettings?.privacy.profileVisibility || DEFAULT_SETTINGS.privacy.profileVisibility;
  if (visibility === "public") return true;
  if (visibility === "followers") return viewerIsFollowing;
  return false;
}

export function canViewListSurface(
  targetSettings: SettingsData | null | undefined,
  viewerIsOwner: boolean,
  viewerIsFollowing: boolean
): boolean {
  if (viewerIsOwner) return true;

  const visibility = targetSettings?.privacy.listVisibility || DEFAULT_SETTINGS.privacy.listVisibility;
  if (visibility === "public") return Boolean(targetSettings?.social.shareListsPublicly ?? DEFAULT_SETTINGS.social.shareListsPublicly);
  if (visibility === "followers") {
    return viewerIsFollowing && Boolean(targetSettings?.social.shareListsPublicly ?? DEFAULT_SETTINGS.social.shareListsPublicly);
  }
  return false;
}

export function canViewLogSurface(
  targetSettings: SettingsData | null | undefined,
  viewerIsOwner: boolean,
  viewerIsFollowing: boolean
): boolean {
  if (viewerIsOwner) return true;

  const visibility = targetSettings?.privacy.logVisibility || DEFAULT_SETTINGS.privacy.logVisibility;
  if (visibility === "public") return true;
  if (visibility === "followers") return viewerIsFollowing;
  return false;
}

export function canViewActivitySurface(
  targetSettings: SettingsData | null | undefined,
  viewerIsOwner: boolean,
  viewerIsFollowing: boolean
): boolean {
  if (viewerIsOwner) return true;

  const visibility = targetSettings?.privacy.activityVisibility || DEFAULT_SETTINGS.privacy.activityVisibility;
  if (visibility === "public") return true;
  if (visibility === "followers") return viewerIsFollowing;
  return false;
}

export function canShowSharedMovies(
  targetSettings: SettingsData | null | undefined,
  viewerIsOwner: boolean,
  viewerIsFollowing: boolean
): boolean {
  if (viewerIsOwner) return true;
  if (!canViewProfileSurface(targetSettings, viewerIsOwner, viewerIsFollowing)) return false;
  return Boolean(targetSettings?.social.showSharedMovies ?? DEFAULT_SETTINGS.social.showSharedMovies);
}

export function canInviteCollaborators(
  targetSettings: SettingsData | null | undefined
): boolean {
  return Boolean(targetSettings?.social.allowCollaborations ?? DEFAULT_SETTINGS.social.allowCollaborations);
}

export type NotificationPreferenceKey =
  | "followRequests"
  | "likeNotifications"
  | "commentNotifications"
  | "shareNotifications"
  | "collaborationInvites"
  | "matcherUpdates"
  | "emailNotifications";

export type NotificationType =
  | "follow_request"
  | "collaboration_request"
  | "post_like"
  | "post_save"
  | "post_comment"
  | "comment_reply"
  | "like"
  | "share_reply"
  | "share_received"
  | "log_comment"
  | "log_comment_reply"
  | "log_comment_like"
  | "matcher_update";

export function notificationPreferenceForType(type: NotificationType): NotificationPreferenceKey {
  if (type === "follow_request") return "followRequests";
  if (type === "collaboration_request") return "collaborationInvites";
  if (type === "matcher_update") return "matcherUpdates";
  if (type === "share_reply" || type === "share_received") return "shareNotifications";
  if (type === "post_like" || type === "like" || type === "log_comment_like" || type === "post_save") {
    return "likeNotifications";
  }
  return "commentNotifications";
}

export function shouldShowNotificationForSettings(
  settings: SettingsData | null | undefined,
  type: NotificationType
): boolean {
  const key = notificationPreferenceForType(type);
  return Boolean(settings?.notifications[key] ?? DEFAULT_SETTINGS.notifications[key]);
}

export async function shouldDeliverNotificationToUser(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  const snapshot = await get(ref(db, `users/${userId}`));
  const settings = getSettingsFromUserRecord(snapshot.exists() ? snapshot.val() : null);
  const preferenceKey = notificationPreferenceForType(type);
  return Boolean(settings.notifications[preferenceKey]);
}

export async function shouldEnablePushNotificationsForUser(userId: string): Promise<boolean> {
  const snapshot = await get(ref(db, `users/${userId}`));
  const settings = getSettingsFromUserRecord(snapshot.exists() ? snapshot.val() : null);
  return Boolean(settings.notifications.pushNotifications);
}
