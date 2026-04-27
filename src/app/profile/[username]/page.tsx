// IMPORTANT: Enforce all permission checks and data validation in your backend (Firebase/Supabase rules) to prevent privilege escalation or data leaks.
// Never trust client-side checks alone for security.
// Sanitize and validate all user input server-side as well.
// Consider rate limiting and monitoring for abuse.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import DOMPurify from 'dompurify';
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, remove, set } from "firebase/database";
import { ArrowLeft, Loader2, MoreHorizontal, Sparkles, Upload, Users } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import StatsInsights from "@/components/StatsInsights";
import CinematicLoading from "@/components/CinematicLoading";
import ProfileCinePostsPanel from "@/components/ProfileCinePostsPanel";
import { auth, db } from "@/lib/firebase";
import { createMovieLog, getUserMovieLogs } from "@/lib/logs";
import { getListWithDetails, getUserLists } from "@/lib/lists";
import { searchMovies } from "@/lib/tmdb";
import {
  DEFAULT_SETTINGS,
  canShowSharedMovies,
  canViewActivitySurface,
  canViewListSurface,
  canViewProfileSurface,
  isUsernameBlocked,
  mergeSettings,
  shouldDeliverNotificationToUser,
} from "@/lib/settings";
import {
  getMostWatchedGenres,
  getUserByUsername,
  getUserProfile,
  getUserStats,
  updateUserProfile,
} from "@/lib/profile";
import {
  acceptFollowRequest as persistAcceptFollowRequest,
  createFollowRequestNotification,
} from "@/lib/notifications";
import { signOut as authSignOut } from "@/lib/auth";
import type { List, ListWithItems, MovieLogWithContent, User } from "@/types";

type FollowModalType = "followers" | "following" | "requests" | "sent-requests";

interface SocialNotification {
  id: string;
  type: "follow_request" | "collaboration_request" | "post_like" | "post_save" | "post_comment" | "comment_reply" | "share_reply";
  fromUser: User;
  createdAt: string;
  followRequestState?: "pending" | "accepted";
  listId?: string;
  listName?: string;
  ref_id?: string;
}

interface FollowRecord {
  id: string;
  follower_id: string;
  following_id: string;
  status: "pending" | "accepted";
  created_at?: string;
  createdAt?: string;
}

function formatCompactCount(count: number): string {
  if (count < 1000) return String(count);
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: count < 100000 ? 1 : 0,
    notation: "compact",
  }).format(count).toLowerCase();
}

function getRecentMoodGenres(logs: MovieLogWithContent[], limit = 1): string[] {
  const genreScores = new Map<string, { count: number; firstSeen: number }>();

  logs.forEach((log, index) => {
    const genres = log.content?.genres || [];
    genres.forEach((genre) => {
      const current = genreScores.get(genre);
      if (current) {
        current.count += 1;
      } else {
        genreScores.set(genre, { count: 1, firstSeen: index });
      }
    });
  });

  return Array.from(genreScores.entries())
    .sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return a[1].firstSeen - b[1].firstSeen;
    })
    .slice(0, limit)
    .map(([genre]) => genre);
}

function getCurrentMoodGenres(logs: MovieLogWithContent[]): string[] {
  const recentMovieLogs = logs
    .filter((log) => log.content_type === "movie" && !log.watch_later && Boolean(log.watched_date))
    .slice(0, 4);

  if (recentMovieLogs.length === 0) return [];

  return getRecentMoodGenres(recentMovieLogs, 3);
}

function ProfilePageInner() {
    // --- Ratings Import Modal State ---
    const [isRatingsImportOpen, setIsRatingsImportOpen] = useState(false);
    const [ratingsImportLoading, setRatingsImportLoading] = useState(false);
    const [ratingsImportError, setRatingsImportError] = useState("");
    const [ratingsImportSummary, setRatingsImportSummary] = useState<null | { totalRows: number; imported: number; skipped: number }>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const username = params.username as string;




  // --- State declarations (must be before all hooks/functions) ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [currentUserSettings, setCurrentUserSettings] = useState(DEFAULT_SETTINGS);
  const [profileUserSettings, setProfileUserSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mostWatchedGenres, setMostWatchedGenres] = useState<any[]>([]);
  const [recentMoodGenres, setRecentMoodGenres] = useState<string[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [listsLoading, setListsLoading] = useState(false);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [allFollows, setAllFollows] = useState<FollowRecord[]>([]);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [displayList, setDisplayList] = useState<ListWithItems | null>(null);
  const [ownerPublicLists, setOwnerPublicLists] = useState<any[]>([]);
  const [ownerPublicListsLoading, setOwnerPublicListsLoading] = useState(false);
  const [profileLists, setProfileLists] = useState<List[]>([]);
  const [selectedDisplayListId, setSelectedDisplayListId] = useState("");
  const [updatingDisplayList, setUpdatingDisplayList] = useState(false);
  const [displayListMenuOpen, setDisplayListMenuOpen] = useState(false);
  const [displayListConnectOpen, setDisplayListConnectOpen] = useState(false);
  const displayListMenuRef = useRef<HTMLDivElement | null>(null);

  // --- End state declarations ---

  const displayListTitleClass = displayList
    ? displayList.name.length > 36
      ? "text-lg sm:text-xl"
      : displayList.name.length > 24
        ? "text-xl sm:text-2xl"
        : "text-2xl sm:text-[2.15rem]"
    : "text-2xl sm:text-[2.15rem]";

  const displayListTitleStyle = displayList
    ? {
        fontSize: (() => {
          const wordCount = displayList.name.trim().split(/\s+/).filter(Boolean).length;
          if (wordCount >= 8 || displayList.name.length > 48) return "1rem";
          if (wordCount >= 7 || displayList.name.length > 40) return "1.08rem";
          if (wordCount >= 6 || displayList.name.length > 34) return "1.2rem";
          if (wordCount >= 5 || displayList.name.length > 28) return "1.35rem";
          return undefined;
        })(),
      }
    : undefined;

  const hardRedirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const [activeTab, setActiveTab] = useState<string>("posts");
  const [followModalType, setFollowModalType] = useState<FollowModalType>("followers");
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followSearch, setFollowSearch] = useState("");
  const [openFollowMenuUserId, setOpenFollowMenuUserId] = useState<string | null>(null);
  const [followActionLoading, setFollowActionLoading] = useState<string | null>(null);
  const [profileFollowActionLoading, setProfileFollowActionLoading] = useState(false);
  const [profilePageError, setProfilePageError] = useState<string | null>(null);
  const [followRequestError, setFollowRequestError] = useState<string | null>(null);
  const [displayListError, setDisplayListError] = useState<string | null>(null);
  const [followRemovalPrompt, setFollowRemovalPrompt] = useState<{
    kind: "following" | "follower" | "request";
    user: User;
  } | null>(null);

  useEffect(() => {
    if (!displayListMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (displayListMenuRef.current && !displayListMenuRef.current.contains(event.target as Node)) {
        setDisplayListMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [displayListMenuOpen]);

  useEffect(() => {
    const ownsProfile = !!currentUser && !!profileUser && currentUser.id === profileUser.id;

    if (!displayList && ownsProfile) {
      setDisplayListConnectOpen(true);
      return;
    }

    if (displayList) {
      setDisplayListConnectOpen(false);
    }
  }, [currentUser?.id, displayList, profileUser?.id]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[PROFILE] useEffect triggered. username param:', username);
      if (!firebaseUser) {
        console.log('[PROFILE] No firebaseUser, redirecting to login.');
        hardRedirect("/auth/login");
        return;
      }
      try {
        console.log('[PROFILE] Firebase user:', firebaseUser);
        // Fetch current user
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        let currentUserObj = null;
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          currentUserObj = {
            id: userData.id,
            username: userData.username,
            name: userData.name,
            avatar_url: userData.avatar_url || null,
            created_at: userData.createdAt,
          };
          setCurrentUserSettings(mergeSettings(userData?.settings));
        } else {
          currentUserObj = {
            id: firebaseUser.uid,
            username: "user",
            name: firebaseUser.displayName || "User",
            avatar_url: null,
            created_at: new Date().toISOString(),
          };
          setCurrentUserSettings(DEFAULT_SETTINGS);
        }
        setCurrentUser(currentUserObj);
        console.log('[PROFILE] Current user object:', currentUserObj);


        // Determine if viewing own profile
        let profileUserObj = null;
        // Robust own-profile detection: match by username (case-insensitive) or userId
        const isOwnProfile = (
          username?.toLowerCase() === currentUserObj.username?.toLowerCase() ||
          username === currentUserObj.id
        );
        if (isOwnProfile) {
          // Viewing own profile: fetch by user ID
          profileUserObj = await getUserProfile(currentUserObj.id);
          console.log('[PROFILE] getUserProfile by ID result:', profileUserObj);
          // Fallback: if not found by user ID, try by username
          if (!profileUserObj) {
            profileUserObj = await getUserByUsername(username);
            console.log('[PROFILE] getUserByUsername fallback result:', profileUserObj);
          }
        } else {
          // Viewing someone else's profile: fetch by username
          profileUserObj = await getUserByUsername(username);
          console.log('[PROFILE] getUserByUsername result:', profileUserObj);
        }
        // Final fallback: if still not found and this is current user, try by user ID
        if (!profileUserObj && isOwnProfile) {
          profileUserObj = await getUserProfile(currentUserObj.id);
          console.log('[PROFILE] Final fallback getUserProfile by ID result:', profileUserObj);
        }
        if (!profileUserObj) {
          const allUsersSnapshot = await get(ref(db, "users"));
          if (allUsersSnapshot.exists()) {
            const allUsersRaw = allUsersSnapshot.val() as Record<string, any>;
            const normalizedSlug = String(username || "").trim().replace(/^@/, "").toLowerCase();
            const legacyNameMatch = Object.values(allUsersRaw).find((user: any) => {
              const storedName = String(user?.name || "").trim().toLowerCase();
              return storedName === normalizedSlug;
            });

            if (legacyNameMatch) {
              profileUserObj = {
                id: legacyNameMatch.id || legacyNameMatch.user_id,
                username: legacyNameMatch.username || "",
                name: legacyNameMatch.name || "",
                avatar_url: legacyNameMatch.avatar_url || null,
                avatar_scale: typeof legacyNameMatch.avatar_scale === "number" ? legacyNameMatch.avatar_scale : 1,
                created_at: legacyNameMatch.createdAt,
                bio: legacyNameMatch.bio || "",
                display_list_id: legacyNameMatch.display_list_id || undefined,
                mood_tags: legacyNameMatch.mood_tags || [],
                mood_tags_updated_at: legacyNameMatch.mood_tags_updated_at,
              } as User;
              setProfileUserSettings(mergeSettings(legacyNameMatch?.settings));
              console.log('[PROFILE] Legacy name fallback result:', profileUserObj);
            }
          }
        }
        if (!profileUserObj) {
          console.log('[PROFILE] User not found after all attempts.');
          setProfilePageError("User not found.");
          setLoading(false);
          return;
        }
        setProfileUser(profileUserObj);
        console.log('[PROFILE] Profile user set:', profileUserObj);

        const [
          followersSnap,
          usersSnap,
          notificationsSnap,
          connectedDisplayList,
        ] = await Promise.all([
          get(ref(db, `follows`)),
          get(ref(db, `users`)),
          isOwnProfile
            ? get(ref(db, `notifications/${profileUserObj.id}`))
            : Promise.resolve(null),
          profileUserObj.display_list_id
            ? getListWithDetails(profileUserObj.display_list_id).catch(() => null)
            : Promise.resolve(null),
        ]);

        const allFollowsRaw: FollowRecord[] = followersSnap.exists()
          ? Object.entries(
              followersSnap.val() as Record<
                string,
                Omit<FollowRecord, "id">
              >
            ).map(([id, follow]) => ({ id, ...follow }))
          : [];
        // Followers: those whose following_id === profileUserObj.id && status === 'accepted'
        const followerUserIds = allFollowsRaw
          .filter((f) => f.following_id === profileUserObj.id && f.status === 'accepted')
          .map((f) => f.follower_id);
        // Following: those whose follower_id === profileUserObj.id && status === 'accepted'
        const followingUserIds = allFollowsRaw
          .filter((f) => f.follower_id === profileUserObj.id && f.status === 'accepted')
          .map((f) => f.following_id);

        setFollowerCount(followerUserIds.length);
        setFollowingCount(followingUserIds.length);
        console.log('[PROFILE] Follower count:', followerUserIds.length, 'Following count:', followingUserIds.length);

        const allUsersRaw = usersSnap.exists() ? usersSnap.val() : {};
        const profileRawUser = allUsersRaw[profileUserObj.id] || profileUserObj;
        setProfileUserSettings(mergeSettings(profileRawUser?.settings));
        const followersArr = followerUserIds.map((uid: string) => allUsersRaw[uid]).filter(Boolean);
        const followingArr = followingUserIds.map((uid: string) => allUsersRaw[uid]).filter(Boolean);
        setFollowers(followersArr);
        setFollowing(followingArr);
        setAllFollows(allFollowsRaw);
        setUsersById(allUsersRaw);

        if (notificationsSnap?.exists()) {
          const notificationRows: SocialNotification[] = notificationsSnap.exists()
            ? Object.entries(notificationsSnap.val()).map(([id, raw]: any) => ({
                id,
                type: raw.type,
                fromUser: raw.fromUser || {
                  id: "",
                  username: "user",
                  name: "Someone",
                  avatar_url: null,
                  created_at: new Date().toISOString(),
                },
                createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
                followRequestState: raw.followRequestState || "pending",
                listId: raw.listId,
                listName: raw.listName,
                ref_id: raw.ref_id,
              }))
            : [];
          setNotifications(
            notificationRows.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );
        } else {
          setNotifications([]);
        }

        if (profileUserObj.display_list_id) {
          setDisplayList(
            connectedDisplayList &&
              connectedDisplayList.privacy === "public" &&
              (isOwnProfile || profileUserSettings.social.shareListsPublicly)
              ? connectedDisplayList
              : null
          );
          setSelectedDisplayListId(profileUserObj.display_list_id);
        } else {
          setDisplayList(null);
          setSelectedDisplayListId("");
        }

        setLoading(false);
      } catch (error) {
        console.error('[PROFILE] Error in profile loading:', error);
        setProfilePageError("Failed to load profile. Please try again later.");
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [username, router]);

  const isOwnProfile = !!currentUser && !!profileUser && currentUser.id === profileUser.id;

  const viewerToProfileFollow = useMemo(() => {
    if (!currentUser || !profileUser) return null;
    return (
      allFollows.find(
        (follow) => follow.follower_id === currentUser.id && follow.following_id === profileUser.id
      ) || null
    );
  }, [allFollows, currentUser, profileUser]);

  const profileToViewerPendingFollow = useMemo(() => {
    if (!currentUser || !profileUser) return null;
    return (
      allFollows.find(
        (follow) =>
          follow.follower_id === profileUser.id &&
          follow.following_id === currentUser.id &&
          follow.status === "pending"
      ) || null
    );
  }, [allFollows, currentUser, profileUser]);

  const isFollowingProfile = viewerToProfileFollow?.status === "accepted";
  const isFollowRequestSent = viewerToProfileFollow?.status === "pending";
  const profileFollowsCurrentUser = useMemo(() => {
    if (!currentUser || !profileUser) return null;
    return (
      allFollows.find(
        (follow) =>
          follow.follower_id === profileUser.id &&
          follow.following_id === currentUser.id &&
          follow.status === "accepted"
      ) || null
    );
  }, [allFollows, currentUser, profileUser]);
  const profileFollowVisibility = profileUserSettings.privacy.profileVisibility;
  const profileFollowState: "follow" | "follow-back" | "following" | "requested" = isFollowRequestSent
    ? "requested"
    : isFollowingProfile
      ? "following"
      : profileFollowsCurrentUser
        ? "follow-back"
        : "follow";
  const hasIncomingFollowRequestFromProfile = !!profileToViewerPendingFollow;
  const isBlockedByProfile =
    !!currentUser && !!profileUser && isUsernameBlocked(profileUserSettings, currentUser.username);
  const isBlockingProfile =
    !!currentUser && !!profileUser && isUsernameBlocked(currentUserSettings, profileUser.username);
  const canAccessProfile =
    !!profileUser &&
    (isOwnProfile ||
      (canViewProfileSurface(profileUserSettings, false, isFollowingProfile) &&
        !isBlockedByProfile &&
        !isBlockingProfile));
  const canAccessLists =
    !!profileUser && (isOwnProfile || canViewListSurface(profileUserSettings, false, isFollowingProfile));
  const canAccessActivity =
    !!profileUser && (isOwnProfile || canViewActivitySurface(profileUserSettings, false, isFollowingProfile));
  const canShowSharedMoviesLink =
    !!profileUser && !isOwnProfile && isFollowingProfile && canShowSharedMovies(profileUserSettings, false, true);
  const canSendFollowRequest =
    !!profileUser &&
    !isOwnProfile &&
    !isBlockedByProfile &&
    !isBlockingProfile &&
    profileFollowVisibility !== "public";

  useEffect(() => {
    if (!profileUser || !canAccessActivity) {
      setRecentMoodGenres([]);
      return;
    }

    let cancelled = false;

    const loadMoodGenres = async () => {
      try {
        const recentLogs = await getUserMovieLogs(profileUser.id, 4);
        if (cancelled) return;
        setRecentMoodGenres(getCurrentMoodGenres(recentLogs));
      } catch (error) {
        console.error("[PROFILE] Error loading mood genres:", error);
        if (!cancelled) {
          setRecentMoodGenres([]);
        }
      }
    };

    loadMoodGenres();

    return () => {
      cancelled = true;
    };
  }, [canAccessActivity, profileUser]);

  useEffect(() => {
    if (!profileUser || activeTab !== "stats" || !canAccessActivity) return;

    let cancelled = false;

    const loadStats = async () => {
      try {
        setStatsLoading(true);
          const [statsObj, genres] = await Promise.all([
            getUserStats(profileUser.id),
            getMostWatchedGenres(profileUser.id),
          ]);

        if (cancelled) return;
        setStats(statsObj);
        setMostWatchedGenres(genres);
      } catch (error) {
        console.error("[PROFILE] Error loading stats:", error);
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [activeTab, canAccessActivity, profileUser]);

  useEffect(() => {
    if (!profileUser || activeTab !== "lists" || !canAccessLists) return;

    let cancelled = false;

    const loadLists = async () => {
      try {
        setListsLoading(true);
        const lists = await getUserLists(profileUser.id);
        if (cancelled) return;

        if (isOwnProfile) {
          setProfileLists(lists);
        } else {
          setProfileLists(
            lists.filter(
              (list: List) =>
                list.privacy === "public" &&
                Boolean(profileUserSettings.social.shareListsPublicly)
            )
          );
        }
      } catch (error) {
        console.error("[PROFILE] Error loading lists:", error);
      } finally {
        if (!cancelled) {
          setListsLoading(false);
        }
      }
    };

    loadLists();

    return () => {
      cancelled = true;
    };
  }, [activeTab, canAccessLists, isOwnProfile, profileUser]);

  useEffect(() => {
    if (!profileUser || !isOwnProfile || profileUser.display_list_id || activeTab === "lists") return;

    let cancelled = false;

    const loadOwnerPublicLists = async () => {
      try {
        setOwnerPublicListsLoading(true);
        const lists = await getUserLists(profileUser.id);
        if (cancelled) return;
        setOwnerPublicLists(lists.filter((list: List) => list.privacy === "public"));
      } catch (error) {
        console.error("[PROFILE] Error loading owner public lists:", error);
      } finally {
        if (!cancelled) {
          setOwnerPublicListsLoading(false);
        }
      }
    };

    loadOwnerPublicLists();

    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, profileUser]);

  useEffect(() => {
    setOpenFollowMenuUserId(null);
  }, [activeTab, followModalType]);

  useEffect(() => {
    if (!isOwnProfile && (followModalType === "requests" || followModalType === "sent-requests")) {
      setFollowModalType("followers");
    }
  }, [isOwnProfile, followModalType]);

  useEffect(() => {
    if (!isOwnProfile && activeTab === "saved-posts") {
      setActiveTab("posts");
    }
  }, [activeTab, isOwnProfile]);

  useEffect(() => {
    if (!isOwnProfile || searchParams.get("importRatings") !== "1") return;
    setRatingsImportError("");
    setRatingsImportSummary(null);
    setIsRatingsImportOpen(true);
  }, [isOwnProfile, searchParams]);

  // Email removed from profile for privacy

  const currentlyIntoText = useMemo(() => {
    if (!recentMoodGenres || recentMoodGenres.length === 0) {
      return "Not set yet";
    }
    return recentMoodGenres.join(", ") || "Not set yet";
  }, [recentMoodGenres]);

  const shownUsers = useMemo(() => {
    if (followModalType === "requests" || followModalType === "sent-requests") {
      return [];
    }

    const list = followModalType === "followers" ? followers : following;
    const query = followSearch.trim().toLowerCase();

    if (!query) {
      return list;
    }

    return list.filter((user) => {
      const name = user.name?.toLowerCase() || "";
      const uname = user.username?.toLowerCase() || "";
      return name.includes(query) || uname.includes(query);
    });
  }, [followModalType, followers, following, followSearch]);

  const followRequests = useMemo(
    () => notifications.filter((notification) => notification.type === "follow_request"),
    [notifications]
  );

  const sentFollowRequests = useMemo(() => {
    if (!currentUser) return [];
    return allFollows.filter(
      (follow) => follow.follower_id === currentUser.id && follow.status === "pending"
    );
  }, [allFollows, currentUser]);

  const sentRequestUsers = useMemo(
    () =>
      sentFollowRequests
        .map((follow) => usersById[follow.following_id])
        .filter(Boolean),
    [sentFollowRequests, usersById]
  );

  const getMyAcceptedFollowRecordToUser = (targetUserId: string) => {
    if (!currentUser) return null;
    return (
      allFollows.find(
        (follow) =>
          follow.follower_id === currentUser.id &&
          follow.following_id === targetUserId &&
          follow.status === "accepted"
      ) || null
    );
  };

  const getMyFollowRecordToUser = (targetUserId: string) => {
    if (!currentUser) return null;
    return (
      allFollows.find(
        (follow) => follow.follower_id === currentUser.id && follow.following_id === targetUserId
      ) || null
    );
  };

  const getFollowerRecordToMe = (targetUserId: string) => {
    if (!currentUser) return null;
    return (
      allFollows.find(
        (follow) =>
          follow.follower_id === targetUserId &&
          follow.following_id === currentUser.id &&
          follow.status === "accepted"
      ) || null
    );
  };

  const removeFollowRecord = async (followId: string) => {
    await set(ref(db, `follows/${followId}`), null);
    setAllFollows((prev) => prev.filter((follow) => follow.id !== followId));
  };

  const sendFollowRequestToUser = async (targetUser: Pick<User, "id" | "username" | "name" | "avatar_url">) => {
    if (!currentUser || currentUser.id === targetUser.id) return;
    const existingFollow = allFollows.find(
      (follow) => follow.follower_id === currentUser.id && follow.following_id === targetUser.id
    );
    if (existingFollow) return;

    const followId = `${currentUser.id}-${targetUser.id}-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newFollow: FollowRecord = {
      id: followId,
      follower_id: currentUser.id,
      following_id: targetUser.id,
      status: "pending",
      created_at: createdAt,
      createdAt,
    };

    await set(ref(db, `follows/${followId}`), newFollow);
    await createFollowRequestNotification(targetUser.id, followId, currentUser, createdAt);
    setAllFollows((prev) => [...prev, newFollow]);
  };

  const followBackToUser = async (targetUser: Pick<User, "id" | "username" | "name" | "avatar_url">) => {
    if (!currentUser || currentUser.id === targetUser.id) return;

    const existingFollow = allFollows.find(
      (follow) => follow.follower_id === currentUser.id && follow.following_id === targetUser.id
    );
    const followId = existingFollow?.id || `${currentUser.id}-${targetUser.id}-${Date.now()}`;
    const createdAt = existingFollow?.createdAt || existingFollow?.created_at || new Date().toISOString();
    const acceptedFollow: FollowRecord = {
      id: followId,
      follower_id: currentUser.id,
      following_id: targetUser.id,
      status: "accepted",
      created_at: createdAt,
      createdAt,
    };

    await set(ref(db, `follows/${followId}`), acceptedFollow);
    setAllFollows((prev) => [
      ...prev.filter(
        (follow) => !(follow.follower_id === currentUser.id && follow.following_id === targetUser.id)
      ),
      acceptedFollow,
    ]);

    if (profileUser) {
      if (profileUser.id === targetUser.id && currentUser) {
        setFollowers((prev) => (prev.some((entry) => entry.id === currentUser.id) ? prev : [currentUser, ...prev]));
        setFollowerCount((prev) => prev + 1);
      }

      if (currentUser.id === profileUser.id) {
        const targetAsUser: User = {
          id: targetUser.id,
          username: targetUser.username,
          name: targetUser.name,
          avatar_url: targetUser.avatar_url || null,
          created_at: new Date().toISOString(),
        };

        setFollowing((prev) => (prev.some((entry) => entry.id === targetUser.id) ? prev : [targetAsUser, ...prev]));
        setFollowingCount((prev) => prev + 1);
      }
    }
  };

  const handleSendFollowRequest = async () => {
    if (!currentUser || !profileUser || isOwnProfile || profileFollowActionLoading) return;
    if (!canSendFollowRequest) {
      setFollowRequestError("This user is not accepting follow requests.");
      return;
    }
    setFollowRequestError(null);
    try {
      setProfileFollowActionLoading(true);
      await sendFollowRequestToUser(profileUser);
    } catch (error) {
      setFollowRequestError("Failed to send follow request. Please try again.");
    } finally {
      setProfileFollowActionLoading(false);
    }
  };

  const handlePrimaryProfileFollowAction = async () => {
    if (!currentUser || !profileUser || isOwnProfile || profileFollowActionLoading) return;

    if (profileFollowState === "requested") {
      openFollowRemovalPrompt("request", profileUser);
      return;
    }

    if (profileFollowState === "following") {
      openFollowRemovalPrompt("following", profileUser);
      return;
    }

    if (profileFollowState === "follow-back") {
      try {
        setProfileFollowActionLoading(true);
        await followBackToUser(profileUser);
      } catch (error) {
        console.error("Error following back profile:", error);
      } finally {
        setProfileFollowActionLoading(false);
      }
      return;
    }

    if (profileFollowVisibility === "public") {
      try {
        setProfileFollowActionLoading(true);
        await followBackToUser(profileUser);
      } catch (error) {
        console.error("Error following profile:", error);
      } finally {
        setProfileFollowActionLoading(false);
      }
      return;
    }

    await handleSendFollowRequest();
  };

  const handleUnfollowProfile = async () => {
    if (!viewerToProfileFollow || !profileUser || viewerToProfileFollow.status !== "accepted") return;

    setFollowRequestError(null);
    try {
      setProfileFollowActionLoading(true);
      await removeFollowRecord(viewerToProfileFollow.id);
      setFollowers((prev) => prev.filter((entry) => entry.id !== currentUser?.id));
      setFollowerCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      setFollowRequestError("Failed to unfollow. Please try again.");
    } finally {
      setProfileFollowActionLoading(false);
    }
  };

  const handleAcceptFollowRequest = async (note: SocialNotification) => {
    if (!currentUser) return;
    const followRecord = allFollows.find((follow) => follow.id === note.id);
    if (!followRecord) return;

    const loadingKey = isOwnProfile ? note.fromUser?.id || note.id : null;

    try {
      if (loadingKey) {
        setFollowActionLoading(loadingKey);
      } else {
        setProfileFollowActionLoading(true);
      }

      const updatedFollow: FollowRecord = { ...followRecord, status: "accepted" };
      await set(ref(db, `follows/${note.id}`), updatedFollow);
      await persistAcceptFollowRequest(currentUser.id, note, { keepNotification: true });

      setAllFollows((prev) => prev.map((follow) => (follow.id === note.id ? updatedFollow : follow)));
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === note.id
            ? { ...notification, followRequestState: "accepted", seen: true }
            : notification
        )
      );

      if (isOwnProfile) {
        setFollowers((prev) =>
          prev.some((follower) => follower.id === note.fromUser.id) ? prev : [note.fromUser, ...prev]
        );
        setFollowerCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error accepting follow request:", error);
    } finally {
      if (loadingKey) {
        setFollowActionLoading(null);
      } else {
        setProfileFollowActionLoading(false);
      }
    }
  };

  const handleDeclineFollowRequest = async (followId: string) => {
    try {
      await removeFollowRecord(followId);
      if (currentUser) {
        await remove(ref(db, `notifications/${currentUser.id}/${followId}`));
      }
      setNotifications((prev) => prev.filter((notification) => notification.id !== followId));
    } catch (error) {
      console.error("Error declining follow request:", error);
    }
  };

  const handleDeleteFollowRequestNotification = async (noteId: string) => {
    if (!currentUser) return;

    try {
      await remove(ref(db, `notifications/${currentUser.id}/${noteId}`));
      setNotifications((prev) => prev.filter((notification) => notification.id !== noteId));
    } catch (error) {
      console.error("Error deleting follow request notification:", error);
    }
  };

  const handleFollowBackFromRequest = async (note: SocialNotification) => {
    if (!note.fromUser || !currentUser) return;
    try {
      setFollowActionLoading(note.fromUser.id);
      await followBackToUser(note.fromUser);
    } catch (error) {
      console.error("Error following back from request:", error);
    } finally {
      setFollowActionLoading(null);
    }
  };

  const handleRemoveFollower = async (targetUserId: string) => {
    const followerRecord = allFollows.find(
      (follow) =>
        follow.follower_id === targetUserId &&
        follow.following_id === currentUser?.id &&
        follow.status === "accepted"
    );
    if (!followerRecord) return;

    try {
      setFollowActionLoading(targetUserId);
      await removeFollowRecord(followerRecord.id);
      setFollowers((prev) => prev.filter((entry) => entry.id !== targetUserId));
      setFollowerCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error removing follower:", error);
    } finally {
      setFollowActionLoading(null);
    }
  };

  const handleCancelSentFollowRequest = async (targetUserId: string) => {
    const pendingFollow = allFollows.find(
      (follow) =>
        currentUser &&
        follow.follower_id === currentUser.id &&
        follow.following_id === targetUserId &&
        follow.status === "pending"
    );
    if (!pendingFollow) return;

    try {
      setFollowActionLoading(targetUserId);
      await removeFollowRecord(pendingFollow.id);
      await remove(ref(db, `notifications/${targetUserId}/${pendingFollow.id}`));
    } catch (error) {
      console.error("Error cancelling follow request:", error);
    } finally {
      setFollowActionLoading(null);
    }
  };

  const openFollowRemovalPrompt = (kind: "following" | "follower" | "request", user: User) => {
    setOpenFollowMenuUserId(null);
    setFollowRemovalPrompt({ kind, user });
  };

  const confirmFollowRemoval = async () => {
    if (!followRemovalPrompt) return;

    const { kind, user } = followRemovalPrompt;
    setFollowRemovalPrompt(null);

    if (kind === "following") {
      if (isOwnProfile) {
        await handleRemoveAsFollowing(user.id);
        return;
      }

      await handleUnfollowProfile();
      return;
    }

    if (kind === "request") {
      await handleCancelSentFollowRequest(user.id);
      return;
    }

    await handleRemoveFollower(user.id);
  };

  const handleFollowBack = async (targetUser: User) => {
    try {
      setFollowActionLoading(targetUser.id);
      await followBackToUser(targetUser);
    } catch (error) {
      console.error("Error sending follow back request:", error);
    } finally {
      setFollowActionLoading(null);
    }
  };

  const handleRemoveAsFollowing = async (targetUserId: string) => {
    const followRecord = getMyAcceptedFollowRecordToUser(targetUserId);
    if (!followRecord) return;

    try {
      setFollowActionLoading(targetUserId);
      await removeFollowRecord(followRecord.id);
      setFollowing((prev) => prev.filter((entry) => entry.id !== targetUserId));
      setFollowingCount((prev) => Math.max(0, prev - 1));
      if (profileUser && profileUser.id === targetUserId) {
        setOpenFollowMenuUserId(null);
      }
    } catch (error) {
      console.error("Error removing follow:", error);
    } finally {
      setFollowActionLoading(null);
      setOpenFollowMenuUserId(null);
    }
  };

  const handleStatDrillDown = (type: "total" | "masterpiece" | "good" | "bad") => {
    if (!profileUser) return;

    if (type === "total") {
      router.push(`/user/${profileUser.username}/logs`);
      return;
    }

    const reaction = type === "masterpiece" ? "2" : type === "good" ? "1" : "0";
    router.push(`/user/${profileUser.username}/logs?reaction=${reaction}`);
  };

  const handleConnectDisplayList = async () => {
    if (!profileUser || !isOwnProfile || !selectedDisplayListId) {
      return;
    }
    setDisplayListError(null);
    try {
      setUpdatingDisplayList(true);
      await updateUserProfile(profileUser.id, { display_list_id: selectedDisplayListId });
      const connected = await getListWithDetails(selectedDisplayListId);
      setDisplayList(connected && connected.privacy === "public" ? connected : null);
      setProfileUser((prev) => (prev ? { ...prev, display_list_id: selectedDisplayListId } : prev));
    } catch (error) {
      setDisplayListError("Failed to connect display list. Please try again.");
    } finally {
      setUpdatingDisplayList(false);
    }
  };

  const handleClearDisplayList = async () => {
    if (!profileUser || !isOwnProfile) {
      return;
    }

    try {
      setUpdatingDisplayList(true);
      await updateUserProfile(profileUser.id, { display_list_id: null });
      setDisplayList(null);
      setSelectedDisplayListId("");
      setProfileUser((prev) => (prev ? { ...prev, display_list_id: undefined } : prev));
    } catch (error) {
      console.error("Error clearing display list:", error);
    } finally {
      setUpdatingDisplayList(false);
    }
  };

  const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const parseRatingsCsv = (csvText: string) => {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\ufeff/, "").toLowerCase());
    const dateIdx = headers.findIndex((h) => h === "date");
    const nameIdx = headers.findIndex((h) => h === "name" || h.includes("title"));
    const yearIdx = headers.findIndex((h) => h === "year");
    const ratingIdx = headers.findIndex((h) => h === "rating");

    if (nameIdx === -1 || ratingIdx === -1) {
      throw new Error("CSV must include Name and Rating columns.");
    }

    return lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      return {
        date: dateIdx >= 0 ? cols[dateIdx] : "",
        name: cols[nameIdx] || "",
        year: yearIdx >= 0 ? cols[yearIdx] : "",
        rating: cols[ratingIdx] || "",
      };
    });
  };

  const isValidDateString = (dateText: string) => {
    if (!dateText) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return false;
    const parsed = new Date(dateText);
    return !Number.isNaN(parsed.getTime());
  };

  const getReactionFromRating = (rating: number): 0 | 1 | 2 => {
    if (rating <= 2.5) return 0;
    if (rating >= 4.5) return 2;
    return 1;
  };

  const parseRatingValue = (ratingText: string): number | null => {
    if (!ratingText) return null;

    const cleaned = ratingText
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
      .trim();

    if (!cleaned) return null;

    const parsed = Number(cleaned);
    if (Number.isNaN(parsed)) return null;
    if (parsed < 0 || parsed > 5) return null;

    return parsed;
  };

  const normalizeTitle = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const findBestMovieMatch = async (title: string, year?: string) => {
    const targetTitle = normalizeTitle(title);
    const targetYear = year?.trim();
    const titleWithoutYear = title.replace(/\(\d{4}\)\s*$/, "").trim();
    const queryCandidates = Array.from(
      new Set(
        [
          targetYear ? `${title} ${targetYear}` : "",
          targetYear ? `${titleWithoutYear} ${targetYear}` : "",
          title,
          titleWithoutYear,
        ].filter(Boolean)
      )
    );

    const allResults: any[] = [];
    for (const query of queryCandidates) {
      const results = await searchMovies(query, 1);
      if (results.length > 0) {
        allResults.push(...results);
      }
    }

    if (!allResults.length) return null;

    const uniqueResults = Array.from(new Map(allResults.map((movie) => [movie.id, movie])).values());

    const scored = uniqueResults
      .map((movie) => {
        const movieTitle = normalizeTitle(movie.title || "");
        const movieYear = movie.release_date?.split("-")[0] || "";

        let score = 0;
        if (movieTitle === targetTitle) score += 100;
        else if (movieTitle.includes(targetTitle) || targetTitle.includes(movieTitle)) score += 50;

        if (targetYear) {
          if (movieYear === targetYear) {
            score += 1000;
          } else {
            score = -1;
          }
        }

        return { movie, score };
      })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (targetYear) {
      return scored[0]?.movie || null;
    }

    return scored[0]?.movie || uniqueResults[0] || null;
  };

  const handleRatingsCsvUpload = async (file: File) => {
    if (!currentUser || !profileUser || !isOwnProfile) return;

    try {
      setRatingsImportError("");
      setRatingsImportSummary(null);
      setRatingsImportLoading(true);

      const csvText = await file.text();
      const rows = parseRatingsCsv(csvText);

      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const title = row.name?.trim();
        const ratingValue = parseRatingValue(row.rating);

        if (!title || ratingValue === null) {
          skipped += 1;
          continue;
        }

        const match = await findBestMovieMatch(title, row.year);
        if (!match) {
          skipped += 1;
          continue;
        }

        const watchedDate = isValidDateString(row.date)
          ? row.date
          : new Date().toISOString().split("T")[0];

        await createMovieLog(
          currentUser.id,
          match.id,
          "movie",
          watchedDate,
          getReactionFromRating(ratingValue),
          "Imported from ratings CSV"
        );

        imported += 1;
      }

      setRatingsImportSummary({
        totalRows: rows.length,
        imported,
        skipped,
      });

      const [updatedStats, updatedGenres] = await Promise.all([
        getUserStats(profileUser.id),
        getMostWatchedGenres(profileUser.id),
      ]);
      setStats(updatedStats);
      setMostWatchedGenres(updatedGenres);
    } catch (error) {
      console.error("CSV import failed:", error);
      setRatingsImportError(error instanceof Error ? error.message : "Failed to import CSV file.");
    } finally {
      setRatingsImportLoading(false);
    }
  };

  if (loading || !profileUser) {
    return <CinematicLoading message="This cinematic profile is loading" />;
  }

  return (
    <PageLayout user={currentUser} onSignOut={handleSignOut} headerAction="settings">
      {canAccessProfile ? (
    <div className="relative min-h-screen bg-transparent pb-16 text-[#f5f0de]">
      {/* Error banners for user-facing errors */}
      {profilePageError && (
        <div className="relative z-10 mx-auto mt-4 w-full max-w-7xl rounded-[1.25rem] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 backdrop-blur">
          {profilePageError}
        </div>
      )}
      {followRequestError && (
        <div className="relative z-10 mx-auto mt-4 w-full max-w-7xl rounded-[1.25rem] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 backdrop-blur">
          {followRequestError}
        </div>
      )}
      {displayListError && (
        <div className="relative z-10 mx-auto mt-4 w-full max-w-7xl rounded-[1.25rem] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 backdrop-blur">
          {displayListError}
        </div>
      )}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10 sm:inline-flex"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>

        </div>

        <section className="mx-auto mb-6 max-w-2xl px-2 text-center sm:mb-8 sm:px-4">
          <div className="flex flex-col items-center">
            {profileUser.avatar_url ? (
              <div
                className="h-28 w-28 overflow-hidden rounded-2xl shadow-sm ring-1 ring-white/10 sm:h-32 sm:w-32"
                style={{ backgroundColor: "#0a0a0a" }}
              >
                <div
                  className="h-full w-full"
                  style={{
                    transform: `scale(${profileUser.avatar_scale || 1})`,
                    transformOrigin: "center",
                  }}
                >
                  <img
                    src={profileUser.avatar_url}
                    alt={profileUser.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <div
                className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-[#111111] text-4xl font-black text-[#f5f0de] ring-1 ring-white/10 sm:h-32 sm:w-32"
                style={{
                  transform: `scale(${profileUser.avatar_scale || 1})`,
                  transformOrigin: "center",
                }}
              >
                {profileUser.name.charAt(0).toUpperCase()}
              </div>
            )}

            <h1
              className="mt-4 text-3xl font-black tracking-tight text-[#f5f0de] sm:text-4xl"
              style={{ fontFamily: '"Bodoni Moda", "Playfair Display", "Times New Roman", serif' }}
            >
              {DOMPurify.sanitize(profileUser.name)}
            </h1>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/55 sm:text-base">
              <button
                onClick={() => {
                  setFollowModalType("followers");
                  setFollowSearch("");
                  setIsFollowModalOpen(true);
                }}
                className="font-semibold transition hover:text-[#f5f0de]"
              >
                <span className="font-black text-[#ffb36b]">{formatCompactCount(followerCount)}</span> followers
              </button>
              <span className="text-white/25">•</span>
              <button
                onClick={() => {
                  setFollowModalType("following");
                  setFollowSearch("");
                  setIsFollowModalOpen(true);
                }}
                className="font-semibold transition hover:text-[#f5f0de]"
              >
                <span className="font-black text-[#ffb36b]">{formatCompactCount(followingCount)}</span> following
              </button>
              <span className="text-white/25">•</span>
              <span className="font-semibold text-white/65">@{DOMPurify.sanitize(profileUser.username)}</span>
            </div>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#f5f0de]/60 sm:text-base">
              {profileUser.bio ? DOMPurify.sanitize(profileUser.bio) : "Movie fan"}
            </p>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#f5f0de]/80 sm:text-base">
              <span className="font-semibold text-[#f5f0de]">Current Mood:</span>{" "}
              <span className="font-semibold text-[#ffb36b]">
                {DOMPurify.sanitize(currentlyIntoText)}
              </span>
            </p>

            <div className="mt-4 flex flex-row flex-wrap items-center justify-center gap-2">
              {!isOwnProfile && currentUser && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {hasIncomingFollowRequestFromProfile ? (
                    <>
                      <button
                        onClick={() =>
                          profileToViewerPendingFollow &&
                          handleAcceptFollowRequest({
                            id: profileToViewerPendingFollow.id,
                            type: "follow_request",
                            fromUser: profileUser,
                            createdAt:
                              profileToViewerPendingFollow.created_at ||
                              profileToViewerPendingFollow.createdAt ||
                              new Date().toISOString(),
                          })
                        }
                        disabled={profileFollowActionLoading}
                        className="inline-flex w-auto min-w-[10rem] items-center justify-center rounded-full border border-[#ff7a1a] bg-[#ff7a1a] px-4 py-2 text-xs font-black text-black transition hover:bg-[#ff8d33] disabled:opacity-50 sm:px-5 sm:py-2.5 sm:text-sm"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() =>
                          profileToViewerPendingFollow &&
                          handleDeclineFollowRequest(profileToViewerPendingFollow.id)
                        }
                        disabled={profileFollowActionLoading}
                        className="inline-flex w-auto min-w-[10rem] items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-[#f5f0de] transition hover:bg-white/10 disabled:opacity-50 sm:px-5 sm:py-2.5 sm:text-sm"
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handlePrimaryProfileFollowAction}
                      disabled={
                        profileFollowActionLoading ||
                        (profileFollowState === "follow" && profileFollowVisibility === "private" && !canSendFollowRequest)
                      }
                      className={`inline-flex w-auto min-w-[10rem] items-center justify-center rounded-full px-4 py-2 text-xs font-black transition sm:px-5 sm:py-2.5 sm:text-sm ${
                        profileFollowState === "following"
                          ? "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                          : profileFollowState === "requested"
                          ? "border border-white/10 bg-white/5 text-[#ffb36b] hover:bg-white/10"
                          : profileFollowState === "follow-back"
                          ? "border border-[#ff7a1a] bg-[#ff7a1a] text-black hover:bg-[#ff8d33]"
                          : profileFollowVisibility === "private" && !canSendFollowRequest
                          ? "border border-white/10 bg-white/5 text-white/35"
                          : "border border-[#ff7a1a] bg-[#ff7a1a] text-black hover:bg-[#ff8d33]"
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {profileFollowState === "following"
                        ? "Following"
                        : profileFollowState === "requested"
                          ? "Requested"
                          : profileFollowState === "follow-back"
                            ? "Follow Back"
                            : "Follow"}
                    </button>
                  )}
                  {profileFollowsCurrentUser && (
                    <span className="inline-flex items-center rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffb36b]">
                      Follows you
                    </span>
                  )}
                </div>
              )}

              {isOwnProfile ? (
                <>
                  <Link
                    href="/profile/edit"
                    className="inline-flex w-auto min-w-[10rem] items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-[#f5f0de] transition hover:bg-white/10 sm:px-5 sm:py-2.5 sm:text-sm"
                  >
                    Edit Profile
                  </Link>
                  <Link
                    href={`/movie-matcher/${profileUser.username}`}
                    className="inline-flex w-auto min-w-[10rem] items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-[#f5f0de] transition hover:bg-white/10 sm:px-5 sm:py-2.5 sm:text-sm"
                  >
                    Movie Matcher
                  </Link>
                </>
              ) : (
                <>
                  {canShowSharedMoviesLink && (
                    <Link
                      href={`/profile/${profileUser.username}/shared-movies`}
                      className="inline-flex w-auto min-w-[10rem] items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-[#f5f0de] transition hover:bg-white/10 sm:px-5 sm:py-2.5 sm:text-sm"
                    >
                      Shared Movies
                    </Link>
                  )}
                  {canAccessProfile && currentUser && (
                    <Link
                      href={`/movie-matcher/${profileUser.username}`}
                      className="inline-flex w-auto min-w-[10rem] items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-[#f5f0de] transition hover:bg-white/10 sm:px-5 sm:py-2.5 sm:text-sm"
                    >
                      Movie Matcher
                    </Link>
                  )}
                </>
              )}
            </div>

            {isOwnProfile && followRequests.length > 0 && (
              <button
                onClick={() => {
                  setFollowModalType("requests");
                  setIsFollowModalOpen(true);
                }}
                className="mt-4 text-xs font-bold text-[#ffb36b] transition hover:text-[#ff7a1a] sm:text-sm"
              >
                {followRequests.length} requests
              </button>
            )}
          </div>
        </section>

        {(displayList || isOwnProfile) && canAccessLists && (
          <section className="mb-8 border-t border-white/10 pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {displayList && (
                    <Link
                      href={`/lists/${displayList.id}`}
                      className={`${displayListTitleClass} block max-w-full whitespace-nowrap leading-tight text-[#f5f0de] transition hover:text-[#ffb36b]`}
                      style={{ ...displayListTitleStyle, fontFamily: '"Bodoni Moda", "Playfair Display", "Times New Roman", serif' }}
                    >
                      {displayList.name}
                    </Link>
                  )}
                  {!displayList && isOwnProfile && (
                    <h2 className="text-2xl font-black text-[#f5f0de] sm:text-3xl">Featured list</h2>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isOwnProfile && (
                    <div ref={displayListMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setDisplayListMenuOpen((prev) => !prev)}
                        className="rounded-full border border-white/10 bg-white/5 p-2 text-[#f5f0de] transition hover:bg-white/10"
                        aria-label="Display list actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {displayListMenuOpen && (
                        <div className="absolute right-0 top-12 z-20 min-w-[190px] rounded-2xl border border-white/10 bg-[#111111] p-2 shadow-xl">
                          {displayList && (
                            <button
                              type="button"
                              onClick={handleClearDisplayList}
                              disabled={updatingDisplayList}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#f5f0de] transition hover:bg-white/5 disabled:opacity-50"
                            >
                              Remove list
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDisplayListConnectOpen(true);
                              setDisplayListMenuOpen(false);
                            }}
                            className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#ffb36b] transition hover:bg-white/5"
                          >
                            Connect other list
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isOwnProfile && displayListConnectOpen && (
                <div className="space-y-3">
                  <p className="text-sm text-white/60">
                    {displayList
                      ? "Switch this featured slot to another public list."
                      : "Connect one of your public lists to feature it on your profile."}
                  </p>

                  {ownerPublicListsLoading ? (
                    <p className="text-sm text-white/55">Loading your public lists...</p>
                  ) : ownerPublicLists.length > 0 ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <select
                        title="Select an option"
                        value={selectedDisplayListId}
                        onChange={(e) => setSelectedDisplayListId(e.target.value)}
                        className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#f5f0de] outline-none focus:ring-2 focus:ring-[#ff7a1a] sm:max-w-sm"
                      >
                        <option value="">Select a public list</option>
                        {ownerPublicLists.map((list: any) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={handleConnectDisplayList}
                        disabled={!selectedDisplayListId || updatingDisplayList}
                        className="rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-black text-black transition hover:bg-[#ff8d33] disabled:opacity-50"
                      >
                        {updatingDisplayList ? "Connecting..." : displayList ? "Switch list" : "Connect list"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-white/55">You have no public lists to connect.</p>
                      <Link
                        href="/lists"
                        className="text-sm font-semibold text-[#ffb36b] hover:text-[#ff7a1a]"
                      >
                        Go to Lists
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {displayList ? (
                displayList.items.length > 0 ? (
                  <div className="-mx-1 overflow-x-auto px-1 pb-2">
                    <div className="flex gap-3 sm:gap-4">
                      {displayList.items.slice(0, 10).map((item) => {
                        const title = item.content?.title || "Untitled";

                        return (
                          <Link
                            key={item.id}
                            href={item.content_type === "movie" ? `/movie/${item.content_id}` : `/tv/${item.content_id}`}
                            className="group w-[5.5rem] shrink-0 sm:w-[120px]"
                          >
                            <div className="relative overflow-hidden rounded-[0.9rem] border border-white/10 bg-white/5 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-[#ff7a1a]/30 group-hover:bg-white/10">
                              {item.content?.poster_url ? (
                                <img
                                  src={item.content.poster_url}
                                  alt={title}
                                  className="aspect-[2/3] w-full object-cover"
                                />
                              ) : (
                                <div className="flex aspect-[2/3] w-full items-center justify-center bg-white/5 text-xs text-white/45">
                                  No poster
                                </div>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/55">This list has no movies yet.</p>
                )
              ) : null}
            </div>
          </section>
        )}

        <section className="mb-8 border-t border-white/10 pt-4">
          <div className="flex overflow-hidden rounded-full border border-[#ff7a1a]/35 bg-[#111111] p-1">
            {canAccessActivity && (
              <>
                <button
                  onClick={() => setActiveTab("posts")}
                  className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
                    activeTab === "posts" ? "bg-[#ff7a1a] text-black shadow-sm" : "text-[#f5f0de]/70 hover:text-[#f5f0de]"
                  }`}
                >
                  Posts
                </button>
                <button
                  onClick={() => setActiveTab("stats")}
                  className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
                    activeTab === "stats" ? "bg-[#ff7a1a] text-black shadow-sm" : "text-[#f5f0de]/70 hover:text-[#f5f0de]"
                  }`}
                >
                  Stats
                </button>
                {isOwnProfile && (
                  <button
                    onClick={() => setActiveTab("saved-posts")}
                    className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
                      activeTab === "saved-posts" ? "bg-[#ff7a1a] text-black shadow-sm" : "text-[#f5f0de]/70 hover:text-[#f5f0de]"
                    }`}
                  >
                    Saved
                  </button>
                )}
              </>
            )}
            {canAccessLists && (
              <button
                onClick={() => setActiveTab("lists")}
                className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
                  activeTab === "lists" ? "bg-[#ff7a1a] text-black shadow-sm" : "text-[#f5f0de]/70 hover:text-[#f5f0de]"
                }`}
              >
                Lists
              </button>
            )}
          </div>
        </section>

        {isFollowModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={() => setIsFollowModalOpen(false)}
              aria-label="Close people list"
            />
            <div className="relative max-h-[86dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#111111] p-4 shadow-2xl sm:rounded-[2rem] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffb36b]/75">People</p>
                  <h2 className="text-xl font-black text-[#f5f0de]">
                    {followModalType === "followers"
                      ? "Followers"
                      : followModalType === "following"
                        ? "Following"
                        : followModalType === "requests"
                          ? "Received Requests"
                          : "Sent Requests"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFollowModalOpen(false)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/5"
                >
                  Close
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
              <button
                onClick={() => setFollowModalType("followers")}
                className={`rounded-full px-4 py-2 font-semibold transition ${
                  followModalType === "followers" ? "bg-[#ff7a1a] text-black" : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                }`}
              >
                {followerCount} Followers
              </button>
              <button
                onClick={() => setFollowModalType("following")}
                className={`rounded-full px-4 py-2 font-semibold transition ${
                  followModalType === "following" ? "bg-[#ff7a1a] text-black" : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                }`}
              >
                {followingCount} Following
              </button>
              {isOwnProfile && (
                <button
                  onClick={() => setFollowModalType("requests")}
                  className={`relative rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    followModalType === "requests"
                      ? "bg-[#ff7a1a] text-black"
                      : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                  }`}
                  >
                  Received Requests
                  {followRequests.length > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-[#ff7a1a] px-2 py-0.5 text-xs font-bold leading-none text-black">
                      {followRequests.length}
                    </span>
                  )}
                </button>
              )}
              {isOwnProfile && (
                <button
                  onClick={() => setFollowModalType("sent-requests")}
                  className={`relative rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    followModalType === "sent-requests"
                      ? "bg-[#ff7a1a] text-black"
                      : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                  }`}
                  >
                  Sent Requests
                  {sentRequestUsers.length > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-[#ff7a1a] px-2 py-0.5 text-xs font-bold leading-none text-black">
                      {sentRequestUsers.length}
                    </span>
                  )}
                </button>
              )}
              {followModalType !== "requests" && followModalType !== "sent-requests" && (
                <input
                  value={followSearch}
                  onChange={e => setFollowSearch(e.target.value)}
                  placeholder={`Search ${followModalType}...`}
                  className="ml-0 min-w-[180px] flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#f5f0de] outline-none placeholder:text-white/35 focus:ring-2 focus:ring-[#ff7a1a]"
                />
              )}
            </div>
            {followModalType === "requests" && isOwnProfile ? (
              <section className="space-y-4 rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#ff7a1a]" />
                  <h2 className="text-lg font-bold text-[#f5f0de]">Received Requests</h2>
                </div>
                {followRequests.length === 0 ? (
                  <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-white/55">
                    No incoming friend requests.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followRequests.map((note) => (
                      (() => {
                        const requesterFollowFromCurrentUser = getMyFollowRecordToUser(note.fromUser.id);
                        const isFollowingRequester = requesterFollowFromCurrentUser?.status === "accepted";
                        const hasPendingRequestToRequester = requesterFollowFromCurrentUser?.status === "pending";

                        return (
                      <div
                        key={note.id}
                        className="flex items-center justify-between rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          {note.fromUser.avatar_url ? (
                            <img
                              src={note.fromUser.avatar_url}
                              alt={note.fromUser.name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold text-[#f5f0de]">
                              {note.fromUser.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-[#f5f0de]">
                              <span className="font-semibold">{note.fromUser.name}</span> (@{note.fromUser.username})
                              {note.followRequestState === "accepted"
                                ? " - request accepted."
                                : " wants to follow you."}
                            </p>
                            <p className="text-xs text-white/45">{new Date(note.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {isFollowingRequester ? (
                            <button
                              type="button"
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#f5f0de] hover:bg-white/10"
                              disabled
                            >
                              Following
                            </button>
                          ) : hasPendingRequestToRequester ? (
                            <>
                              <button
                                type="button"
                                className="rounded-full bg-[#ff7a1a] px-3 py-1 text-xs font-semibold text-black hover:bg-[#ff8d33]"
                                disabled
                              >
                                Requested
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#f5f0de] hover:bg-white/10"
                                onClick={() => handleCancelSentFollowRequest(note.fromUser.id)}
                                disabled={followActionLoading === note.fromUser.id}
                              >
                                {followActionLoading === note.fromUser.id ? "Deleting..." : "Cancel Request"}
                              </button>
                            </>
                          ) : note.followRequestState === "accepted" ? (
                            <>
                              <button
                                type="button"
                                className="rounded-full bg-[#ff7a1a] px-3 py-1 text-xs font-semibold text-black hover:bg-[#ff8d33]"
                                onClick={() => handleFollowBackFromRequest(note)}
                                disabled={followActionLoading === note.fromUser.id}
                              >
                                {followActionLoading === note.fromUser.id ? "Sending..." : "Follow Back"}
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#f5f0de] hover:bg-white/10"
                                onClick={() => handleDeleteFollowRequestNotification(note.id)}
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="rounded-full bg-[#ff7a1a] px-3 py-1 text-xs font-semibold text-black hover:bg-[#ff8d33]"
                                onClick={() => handleAcceptFollowRequest(note)}
                                disabled={followActionLoading === note.fromUser.id || profileFollowActionLoading}
                              >
                                {followActionLoading === note.fromUser.id || profileFollowActionLoading ? "Confirming..." : "Confirm"}
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#f5f0de] hover:bg-white/10"
                                onClick={() => handleDeclineFollowRequest(note.id)}
                                disabled={followActionLoading === note.fromUser.id || profileFollowActionLoading}
                                >
                                Decline
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                        );
                      })()
                    ))}
                  </div>
                )}
              </section>
            ) : followModalType === "sent-requests" && isOwnProfile ? (
              <section className="space-y-3">
                {sentRequestUsers.length === 0 ? (
                  <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/55">
                    No pending requests sent.
                  </div>
                ) : (
                  sentRequestUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <Link href={`/profile/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold text-[#f5f0de]">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#f5f0de]">{user.name}</p>
                            <p className="truncate text-xs text-white/55">@{user.username}</p>
                          </div>
                        </Link>

                      <button
                        onClick={() => handleCancelSentFollowRequest(user.id)}
                        disabled={followActionLoading === user.id}
                        className="ml-3 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10 disabled:opacity-60"
                      >
                        {followActionLoading === user.id ? "Updating..." : "Cancel Request"}
                      </button>
                    </div>
                  ))
                )}
              </section>
            ) : (
              <div className="space-y-3">
                {shownUsers.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-white/55">
                    No users found.
                  </div>
                ) : (
                  shownUsers.map((listedUser) => {
                    const isMenuOpen = openFollowMenuUserId === listedUser.id;
                    const myFollowToListedUser = getMyFollowRecordToUser(listedUser.id);
                    const followerToMe = getFollowerRecordToMe(listedUser.id);
                    const isFollowingListedUser = myFollowToListedUser?.status === "accepted";
                    const followsYou = !!followerToMe;
                    const rowFollowState: "follow" | "follow-back" | "following" = isFollowingListedUser
                      ? "following"
                      : followsYou
                        ? "follow-back"
                        : "follow";
                    const canShowActionMenu =
                      isOwnProfile &&
                      followModalType === "following" &&
                      myFollowToListedUser?.status === "accepted";
                    const canShowFollowerMenu =
                      isOwnProfile &&
                      followModalType === "followers" &&
                      followerToMe?.status === "accepted" &&
                      !isFollowingListedUser;

                    return (
                      <div
                        key={listedUser.id}
                        className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-white/5"
                      >
                        <Link href={`/profile/${listedUser.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                          {listedUser.avatar_url ? (
                            <img src={listedUser.avatar_url} alt={listedUser.name} className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold text-[#f5f0de]">
                              {listedUser.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#f5f0de]">{listedUser.name}</p>
                            <p className="truncate text-xs text-white/55">@{listedUser.username}</p>
                          </div>
                        </Link>

                        <div className="ml-3 flex items-center gap-2">
                          {rowFollowState === "following" ? (
                            <button
                              onClick={() => openFollowRemovalPrompt("following", listedUser)}
                              disabled={followActionLoading === listedUser.id}
                              className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/10 disabled:opacity-60"
                            >
                              {followActionLoading === listedUser.id ? "Updating..." : "Following"}
                            </button>
                          ) : rowFollowState === "follow-back" ? (
                            <button
                              onClick={() => handleFollowBack(listedUser)}
                              disabled={followActionLoading === listedUser.id}
                              className="rounded-full bg-[#ff7a1a] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#ff8d33] disabled:opacity-60"
                            >
                              {followActionLoading === listedUser.id ? "Sending..." : "Follow Back"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFollowBack(listedUser)}
                              disabled={profileFollowActionLoading}
                              className="rounded-full bg-[#ff7a1a] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#ff8d33] disabled:opacity-60"
                            >
                              Follow
                            </button>
                          )}

                          {followsYou && (
                            <span className="inline-flex items-center rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffb36b]">
                              Follows you
                            </span>
                          )}

                          {canShowFollowerMenu && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenFollowMenuUserId((prev) => (prev === listedUser.id ? null : listedUser.id))
                                }
                                className="rounded-full p-1 text-white/55 hover:bg-white/5 hover:text-[#f5f0de]"
                                aria-label="Open follower actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>

                              {isMenuOpen && (
                                <div className="absolute right-0 top-8 z-20 min-w-[190px] rounded-xl border border-white/10 bg-[#111111] p-1 shadow-lg">
                                  <button
                                    onClick={() => openFollowRemovalPrompt("follower", listedUser)}
                                    disabled={followActionLoading === listedUser.id}
                                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#ffb36b] hover:bg-white/5 disabled:opacity-60"
                                  >
                                    {followActionLoading === listedUser.id ? "Updating..." : "Remove as follower"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {canShowActionMenu && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenFollowMenuUserId((prev) => (prev === listedUser.id ? null : listedUser.id))
                                }
                                className="rounded-full p-1 text-white/55 hover:bg-white/5 hover:text-[#f5f0de]"
                                aria-label="Open follow actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>

                              {isMenuOpen && (
                                <div className="absolute right-0 top-8 z-20 min-w-[170px] rounded-xl border border-white/10 bg-[#111111] p-1 shadow-lg">
                                  <button
                                    onClick={() => openFollowRemovalPrompt("following", listedUser)}
                                    disabled={followActionLoading === listedUser.id}
                                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#ffb36b] hover:bg-white/5 disabled:opacity-60"
                                  >
                                    {followActionLoading === listedUser.id ? "Updating..." : "Remove as following"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          </div>
        )}
        {activeTab === "stats" && canAccessActivity && (
          <div className="space-y-6">
            {statsLoading || !stats ? (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 text-sm text-white/55">
                Loading stats...
              </div>
            ) : (
              <StatsInsights
                genres={mostWatchedGenres}
                masterpieceCount={stats.masterpieceCount}
                goodCount={stats.goodCount}
                badCount={stats.badCount}
                totalWatched={stats.totalLogged}
                onStatClick={handleStatDrillDown}
              />
            )}
          </div>
        )}

        {activeTab === "posts" && profileUser && canAccessActivity && (
          <div className="space-y-3">
            <ProfileCinePostsPanel mode="posts" profileUserId={profileUser.id} currentUser={currentUser} />
          </div>
        )}

        {activeTab === "saved-posts" && profileUser && isOwnProfile && canAccessActivity && (
          <div className="space-y-3">
            <ProfileCinePostsPanel mode="saved" profileUserId={profileUser.id} currentUser={currentUser} />
          </div>
        )}

        {activeTab === "lists" && profileUser && canAccessLists && (
          <section className="space-y-4">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[#f5f0de]">Lists</h2>
                <p className="text-sm text-white/55">
                  {profileUser.name}'s lists
                </p>
              </div>
              <Link
                href="/lists"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10"
              >
                Open lists page
              </Link>
            </div>

            {listsLoading ? (
              <div className="border-b border-white/10 p-8 text-center text-sm text-white/55">
                Loading lists...
              </div>
            ) : profileLists.length === 0 ? (
              <div className="border-b border-white/10 p-8 text-center text-sm text-white/55">
                No lists yet.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {profileLists.map((list) => (
                  <Link
                    key={list.id}
                    href={`/lists/${list.id}`}
                    className="border-b border-white/10 py-4 transition hover:border-[#ff7a1a]/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black text-[#f5f0de] sm:text-base">{list.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/55">
                          {list.description || "No description yet."}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#ff7a1a] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-black">
                        {list.privacy}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-[#f5f0de]">
                        {list.owner_id === profileUser.id ? "Owned" : "Collaborative"}
                      </span>
                      {list.is_ranked && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-[#ffb36b]">
                          Ranked
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

      </div>
      {/* Add extra whitespace at the bottom for visual comfort */}
      <div className="h-12 sm:h-20" />


      {isRatingsImportOpen && isOwnProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#f5f0de]">Import Ratings CSV</h3>
              <button
                onClick={() => setIsRatingsImportOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-[#f5f0de] hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <p className="font-semibold text-[#f5f0de]">Expected CSV columns:</p>
              <p className="mt-1">Date, Name, Year, Rating (Letterboxd URI is ignored)</p>
              <p className="mt-2">Rating mapping:</p>
              <p>0-2.5 = Bad, 3-4 = Good, 4.5-5 = Masterpiece</p>
            </div>

            <div className="mt-4">
              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center hover:bg-white/10">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  disabled={ratingsImportLoading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleRatingsCsvUpload(file);
                    }
                    e.currentTarget.value = "";
                  }}
                />
                <div>
                  {ratingsImportLoading ? (
                    <>
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#ff7a1a]" />
                      <p className="mt-2 text-sm font-medium text-[#f5f0de]">Importing ratings...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto h-6 w-6 text-[#ff7a1a]" />
                      <p className="mt-2 text-sm font-medium text-[#f5f0de]">Click to upload ratings CSV file</p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {ratingsImportError && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {ratingsImportError}
              </div>
            )}

            {ratingsImportSummary && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Imported {ratingsImportSummary.imported} of {ratingsImportSummary.totalRows} rows.
                {" "}Skipped {ratingsImportSummary.skipped} rows.
              </div>
            )}
          </div>
        </div>
      )}

      {followRemovalPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close follow removal prompt"
            onClick={() => setFollowRemovalPrompt(null)}
          />
          <div className="relative w-full max-w-md rounded-[1.5rem] border border-white/10 bg-[#111111] p-5 shadow-2xl sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ffb36b]">Warning</p>
              <h3 className="mt-2 text-xl font-black text-[#f5f0de]">
                {followRemovalPrompt.kind === "following"
                  ? `Remove ${followRemovalPrompt.user.name} from following?`
                  : followRemovalPrompt.kind === "request"
                    ? `Cancel request to ${followRemovalPrompt.user.name}?`
                    : `Remove ${followRemovalPrompt.user.name} as a follower?`}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/55">
                {followRemovalPrompt.kind === "following"
                  ? `This will stop you from following @${followRemovalPrompt.user.username}.`
                  : followRemovalPrompt.kind === "request"
                    ? `This will cancel your follow request to @${followRemovalPrompt.user.username}.`
                  : `This will remove @${followRemovalPrompt.user.username} from your followers list.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFollowRemovalPrompt(null)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmFollowRemoval}
                disabled={
                  followActionLoading === followRemovalPrompt.user.id ||
                  profileFollowActionLoading
                }
                className="rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-black text-black transition hover:bg-[#ff8d33] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {followActionLoading === followRemovalPrompt.user.id || profileFollowActionLoading
                  ? "Removing..."
                  : followRemovalPrompt.kind === "request"
                    ? "Cancel Request"
                    : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      ) : (
        <div className="relative z-10 mx-auto flex min-h-[60dvh] w-full max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10 sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </button>
          </div>
          <section className="rounded-[1.5rem] border border-white/10 bg-[#111111] p-6 text-center shadow-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffb36b]/75">Private profile</p>
            <h1 className="mt-3 text-3xl font-black text-[#f5f0de] sm:text-4xl">
              This profile is not visible right now.
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/55 sm:text-base">
              The owner has limited who can view this profile, or you may be blocked.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-black text-black transition hover:bg-[#ff8d33]"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={() => router.back()}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10"
              >
                Go Back
              </button>
            </div>
          </section>
        </div>
      )}
    </PageLayout>
  );
}

export default function ProfilePage() {
  return (
    <ErrorBoundary>
      <ProfilePageInner />
    </ErrorBoundary>
  );
}
