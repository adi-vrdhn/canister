// IMPORTANT: Enforce all permission checks and data validation in your backend (Firebase/Supabase rules) to prevent privilege escalation or data leaks.
// Never trust client-side checks alone for security.
// Sanitize and validate all user input server-side as well.
// Consider rate limiting and monitoring for abuse.

"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import DOMPurify from 'dompurify';
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, remove, set } from "firebase/database";
import { ArrowLeft, Loader2, MoreHorizontal, Settings, Sparkles, Upload, Users } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import StatsInsights from "@/components/StatsInsights";
import CinematicLoading from "@/components/CinematicLoading";
import ProfileCinePostsPanel from "@/components/ProfileCinePostsPanel";
import { auth, db } from "@/lib/firebase";
import { createMovieLog, getUserMovieLogs } from "@/lib/logs";
import { getListWithDetails, getUserLists } from "@/lib/lists";
import { searchMovies } from "@/lib/tmdb";
import {
  getMostWatchedGenres,
  getUserByUsername,
  getUserProfile,
  getUserStats,
  updateUserProfile,
} from "@/lib/profile";
import { signOut as authSignOut } from "@/lib/auth";
import type { List, ListWithItems, MovieLogWithContent, User } from "@/types";

type FollowModalType = "followers" | "following" | "requests" | "sent-requests";

interface SocialNotification {
  id: string;
  type: "follow_request" | "collaboration_request" | "post_like" | "post_save" | "post_comment" | "comment_reply";
  fromUser: User;
  createdAt: string;
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

function getRecentMoodGenres(logs: MovieLogWithContent[], limit = 3): string[] {
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

  // --- End state declarations ---

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
        } else {
          currentUserObj = {
            id: firebaseUser.uid,
            username: "user",
            name: firebaseUser.displayName || "User",
            avatar_url: null,
            created_at: new Date().toISOString(),
          };
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
                created_at: legacyNameMatch.createdAt,
                bio: legacyNameMatch.bio || "",
                display_list_id: legacyNameMatch.display_list_id || undefined,
                mood_tags: legacyNameMatch.mood_tags || [],
                mood_tags_updated_at: legacyNameMatch.mood_tags_updated_at,
              } as User;
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
          setDisplayList(connectedDisplayList && connectedDisplayList.privacy === "public" ? connectedDisplayList : null);
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

  useEffect(() => {
    if (!profileUser || activeTab !== "stats") return;

    let cancelled = false;

    const loadStats = async () => {
      try {
        setStatsLoading(true);
        const [statsObj, genres, recentLogs] = await Promise.all([
          getUserStats(profileUser.id),
          getMostWatchedGenres(profileUser.id),
          getUserMovieLogs(profileUser.id, 5),
        ]);

        if (cancelled) return;
        setStats(statsObj);
        setMostWatchedGenres(genres);
        setRecentMoodGenres(getRecentMoodGenres(recentLogs));
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
  }, [activeTab, profileUser]);

  useEffect(() => {
    if (!profileUser || activeTab !== "lists") return;

    let cancelled = false;

    const loadLists = async () => {
      try {
        setListsLoading(true);
        const lists = await getUserLists(profileUser.id);
        if (cancelled) return;

        setProfileLists(isOwnProfile ? lists : lists.filter((list: List) => list.privacy === "public"));
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
  }, [activeTab, isOwnProfile, profileUser]);

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
    return recentMoodGenres.join(", ");
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
  const hasIncomingFollowRequestFromProfile = !!profileToViewerPendingFollow;

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

  const removeFollowRecord = async (followId: string) => {
    await set(ref(db, `follows/${followId}`), null);
    setAllFollows((prev) => prev.filter((follow) => follow.id !== followId));
  };

  const sendFollowRequestToUser = async (targetUser: User) => {
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
    await set(ref(db, `notifications/${targetUser.id}/${followId}`), {
      type: "follow_request",
      seen: false,
      fromUser: {
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name,
        avatar_url: currentUser.avatar_url || null,
      },
      created_at: createdAt,
      createdAt,
    });
    setAllFollows((prev) => [...prev, newFollow]);
  };

  const handleSendFollowRequest = async () => {
    if (!currentUser || !profileUser || isOwnProfile || profileFollowActionLoading) return;
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

  const handleUnfollowProfile = async () => {
    if (!viewerToProfileFollow || !profileUser || viewerToProfileFollow.status !== "accepted") return;
    const shouldUnfollow = window.confirm(`Unfollow @${profileUser.username}?`);
    if (!shouldUnfollow) return;

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

    try {
      const updatedFollow: FollowRecord = { ...followRecord, status: "accepted" };
      await set(ref(db, `follows/${note.id}`), updatedFollow);
      await remove(ref(db, `notifications/${currentUser.id}/${note.id}`));

      setAllFollows((prev) => prev.map((follow) => (follow.id === note.id ? updatedFollow : follow)));
      setNotifications((prev) => prev.filter((notification) => notification.id !== note.id));

      if (isOwnProfile) {
        setFollowers((prev) =>
          prev.some((follower) => follower.id === note.fromUser.id) ? prev : [note.fromUser, ...prev]
        );
        setFollowerCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error accepting follow request:", error);
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

  const handleFollowBack = async (targetUser: User) => {
    try {
      setFollowActionLoading(targetUser.id);
      await sendFollowRequestToUser(targetUser);
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
    <PageLayout user={currentUser} onSignOut={handleSignOut}>
    <div className="relative min-h-screen bg-transparent pb-16 text-slate-950">
      {/* Error banners for user-facing errors */}
      {profilePageError && (
        <div className="relative z-10 mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-red-400/40 bg-red-900/40 px-4 py-3 text-sm text-red-100 backdrop-blur">
          {profilePageError}
        </div>
      )}
      {followRequestError && (
        <div className="relative z-10 mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-red-400/40 bg-red-900/40 px-4 py-3 text-sm text-red-100 backdrop-blur">
          {followRequestError}
        </div>
      )}
      {displayListError && (
        <div className="relative z-10 mx-auto mt-4 w-full max-w-7xl rounded-2xl border border-red-400/40 bg-red-900/40 px-4 py-3 text-sm text-red-100 backdrop-blur">
          {displayListError}
        </div>
      )}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>

          {isOwnProfile && (
            <Link
              href="/profile/settings"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          )}
        </div>

        <section className="mb-8 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200/80 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              {profileUser.avatar_url ? (
                <img
                  src={profileUser.avatar_url}
                  alt={profileUser.name}
                  className="h-24 w-20 rounded-[1.1rem] border border-slate-200 object-cover shadow-sm sm:h-28 sm:w-24"
                />
              ) : (
                <div className="flex h-24 w-20 items-center justify-center rounded-[1.1rem] border border-slate-200 bg-slate-950 text-3xl font-semibold text-white shadow-sm sm:h-28 sm:w-24">
                  {profileUser.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1
                      className="min-w-0 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
                      style={{ fontFamily: '"Bodoni Moda", "Playfair Display", "Times New Roman", serif' }}
                    >
                      {DOMPurify.sanitize(profileUser.name)}
                    </h1>

                    <p className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-base font-semibold tracking-wide text-slate-600 sm:text-lg">
                      @{DOMPurify.sanitize(profileUser.username)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-600 sm:text-base">
                      <button
                        onClick={() => {
                          setFollowModalType("followers");
                          setFollowSearch("");
                          setIsFollowModalOpen(true);
                        }}
                        className="font-medium transition hover:text-slate-950"
                      >
                        <span className="font-bold text-slate-950">{formatCompactCount(followerCount)}</span> followers
                      </button>
                      <button
                        onClick={() => {
                          setFollowModalType("following");
                          setFollowSearch("");
                          setIsFollowModalOpen(true);
                        }}
                        className="font-medium transition hover:text-slate-950"
                      >
                        <span className="font-bold text-slate-950">{formatCompactCount(followingCount)}</span> following
                      </button>
                    </div>
                  </div>

                  {!isOwnProfile && currentUser && (
                    <div className="shrink-0 pt-1 sm:pt-2">
                      {hasIncomingFollowRequestFromProfile ? (
                        <div className="flex items-center gap-2">
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
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-emerald-500 disabled:opacity-50 sm:px-4 sm:text-sm"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() =>
                              profileToViewerPendingFollow &&
                              handleDeclineFollowRequest(profileToViewerPendingFollow.id)
                            }
                            disabled={profileFollowActionLoading}
                            className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-rose-500 disabled:opacity-50 sm:px-4 sm:text-sm"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={isFollowingProfile ? handleUnfollowProfile : handleSendFollowRequest}
                          disabled={isFollowRequestSent || profileFollowActionLoading}
                          className={`rounded-full px-3 py-1.5 text-xs font-black transition sm:px-4 sm:text-sm ${
                            isFollowingProfile
                              ? "border border-slate-300 bg-white text-slate-800 hover:bg-red-50 hover:text-red-700"
                              : isFollowRequestSent
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          {isFollowingProfile ? "Following" : isFollowRequestSent ? "Request Sent" : "Follow"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 bg-white px-4 py-4 sm:px-6 sm:py-5">
            <p className="max-w-2xl text-base leading-snug text-slate-600 sm:text-lg">
              {profileUser.bio ? DOMPurify.sanitize(profileUser.bio) : "Movie fan"}
            </p>
            <p className="max-w-3xl text-base leading-snug text-slate-500 sm:text-lg">
              <span className="font-semibold text-slate-900">Now screening in their mood:</span>{" "}
              {DOMPurify.sanitize(currentlyIntoText)}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/profile/${profileUser.username}/movie-personality`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <Sparkles className="h-5 w-5 text-blue-600" />
                Movie Personality
              </Link>
              {isOwnProfile && followRequests.length > 0 && (
                <button
                  onClick={() => {
                    setFollowModalType("requests");
                    setIsFollowModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  {followRequests.length} requests
                </button>
              )}
              {!isOwnProfile && currentUser && (
                <>
                  <Link
                    href={`/profile/${profileUser.username}/shared-movies`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    Shared movies
                  </Link>
                  <Link
                    href={`/movie-matcher/${profileUser.username}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    Movie matcher
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {(displayList || isOwnProfile) && (
          <section className="relative mb-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-blue-50 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-16 h-44 w-44 rounded-full bg-amber-50 blur-3xl" />
            <div className="relative z-10 mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5">
              <div>
                {displayList && (
                  <h2
                    className="text-2xl font-black text-slate-950 sm:text-3xl"
                    style={{ fontFamily: '"Bodoni Moda", "Playfair Display", "Times New Roman", serif' }}
                  >
                    {displayList.name}
                  </h2>
                )}
              </div>
              <div className="flex items-center gap-3">
                {displayList && (
                  <Link
                    href={`/lists/${displayList.id}`}
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    View full list
                  </Link>
                )}
                {isOwnProfile && displayList && (
                  <button
                    onClick={handleClearDisplayList}
                    disabled={updatingDisplayList}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {displayList ? (
              <div className="relative z-10">
                {displayList.items.length > 0 ? (
                  <div className="-mx-1 overflow-x-auto px-1 pb-2">
                    <div className="flex gap-3 sm:gap-4">
                      {displayList.items.slice(0, 10).map((item) => {
                        const title = item.content?.title || "Untitled";

                        return (
                          <Link
                            key={item.id}
                            href={item.content_type === "movie" ? `/movie/${item.content_id}` : `/tv/${item.content_id}`}
                            className="group w-[7rem] shrink-0 sm:w-[180px]"
                          >
                            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg sm:rounded-2xl">
                              {item.content?.poster_url ? (
                                <img
                                  src={item.content.poster_url}
                                  alt={title}
                                  className="aspect-[2/3] w-full object-cover"
                                />
                              ) : (
                                <div className="flex aspect-[2/3] w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
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
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                    This list has no movies yet.
                  </div>
                )}
              </div>
            ) : isOwnProfile ? (
              <div className="relative z-10 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="mb-3 text-sm font-medium text-slate-700">
                  Connect one of your public lists to feature it on your profile.
                </p>

                {ownerPublicListsLoading ? (
                  <p className="text-sm text-slate-500">Loading your public lists...</p>
                ) : ownerPublicLists.length > 0 ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                      title="Select an option"
                      value={selectedDisplayListId}
                      onChange={(e) => setSelectedDisplayListId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-sm"
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
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updatingDisplayList ? "Connecting..." : "Connect List"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">You have no public lists to connect.</p>
                    <Link
                      href="/lists"
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Go to Lists
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        )}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === "posts" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Posts
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === "stats" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Stats
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab("saved-posts")}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  activeTab === "saved-posts" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Saved
              </button>
            )}
            <button
              onClick={() => setActiveTab("liked-posts")}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === "liked-posts" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Liked
            </button>
            <button
              onClick={() => setActiveTab("lists")}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === "lists" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Lists
            </button>
          </div>
        </section>

        {isFollowModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center">
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={() => setIsFollowModalOpen(false)}
              aria-label="Close people list"
            />
            <div className="relative max-h-[86dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-slate-200 bg-white p-4 shadow-2xl sm:rounded-[2rem] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">People</p>
                  <h2 className="text-xl font-black text-slate-950">
                    {followModalType === "followers"
                      ? "Followers"
                      : followModalType === "following"
                        ? "Following"
                        : followModalType === "requests"
                          ? "Follow Requests"
                          : "Pending Requests"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFollowModalOpen(false)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-3">
              <button
                onClick={() => setFollowModalType("followers")}
                className={`rounded-xl px-4 py-2 font-semibold transition ${followModalType === "followers" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {followerCount} Followers
              </button>
              <button
                onClick={() => setFollowModalType("following")}
                className={`rounded-xl px-4 py-2 font-semibold transition ${followModalType === "following" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {followingCount} Following
              </button>
              {isOwnProfile && (
                <button
                  onClick={() => setFollowModalType("requests")}
                  className={`relative rounded-xl px-4 py-2 font-semibold transition ${
                    followModalType === "requests"
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Requests
                  {followRequests.length > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold leading-none text-red-100">
                      {followRequests.length}
                    </span>
                  )}
                </button>
              )}
              {isOwnProfile && (
                <button
                  onClick={() => setFollowModalType("sent-requests")}
                  className={`relative rounded-xl px-4 py-2 font-semibold transition ${
                    followModalType === "sent-requests"
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Pending
                  {sentRequestUsers.length > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold leading-none text-white">
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
                  className="ml-0 min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
            {followModalType === "requests" && isOwnProfile ? (
              <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-600" />
                  <h2 className="text-lg font-bold text-slate-950">Friend Requests</h2>
                </div>
                {followRequests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                    No incoming friend requests.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followRequests.map((note) => (
                      <div
                        key={note.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          {note.fromUser.avatar_url ? (
                            <img
                              src={note.fromUser.avatar_url}
                              alt={note.fromUser.name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                              {note.fromUser.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-zinc-900">
                              <span className="font-semibold">{note.fromUser.name}</span> (@{note.fromUser.username})
                              {" "}wants to follow you.
                            </p>
                            <p className="text-xs text-zinc-500">{new Date(note.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="rounded-lg bg-green-600 text-white px-3 py-1 text-xs font-semibold hover:bg-green-700"
                            onClick={() => handleAcceptFollowRequest(note)}
                          >
                            Confirm
                          </button>
                          <button
                            className="rounded-lg bg-red-500 text-white px-3 py-1 text-xs font-semibold hover:bg-red-600"
                            onClick={() => handleDeclineFollowRequest(note.id)}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : followModalType === "sent-requests" && isOwnProfile ? (
              <section className="space-y-3">
                {sentRequestUsers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No pending requests sent.
                  </div>
                ) : (
                  sentRequestUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <Link href={`/profile/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{user.name}</p>
                          <p className="truncate text-xs text-slate-500">@{user.username}</p>
                        </div>
                      </Link>

                      <button
                        onClick={() => handleCancelSentFollowRequest(user.id)}
                        disabled={followActionLoading === user.id}
                        className="ml-3 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                      >
                        {followActionLoading === user.id ? "Updating..." : "Cancel"}
                      </button>
                    </div>
                  ))
                )}
              </section>
            ) : (
              <div className="space-y-3">
                {shownUsers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No users found.
                  </div>
                ) : (
                  shownUsers.map((listedUser) => {
                    const isMenuOpen = openFollowMenuUserId === listedUser.id;
                    const myFollowToListedUser = getMyFollowRecordToUser(listedUser.id);
                    const canShowActionMenu =
                      isOwnProfile &&
                      followModalType === "following" &&
                      myFollowToListedUser?.status === "accepted";
                    const canShowFollowBack =
                      isOwnProfile &&
                      followModalType === "followers" &&
                      currentUser?.id !== listedUser.id;

                    return (
                      <div
                        key={listedUser.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:bg-slate-50"
                      >
                        <Link href={`/profile/${listedUser.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                          {listedUser.avatar_url ? (
                            <img src={listedUser.avatar_url} alt={listedUser.name} className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                              {listedUser.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{listedUser.name}</p>
                            <p className="truncate text-xs text-slate-500">@{listedUser.username}</p>
                          </div>
                        </Link>

                        <div className="ml-3 flex items-center gap-2">
                          {canShowFollowBack && (
                            myFollowToListedUser?.status === "accepted" ? (
                              <button
                                onClick={() => handleRemoveAsFollowing(listedUser.id)}
                                disabled={followActionLoading === listedUser.id}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                              >
                                {followActionLoading === listedUser.id ? "Updating..." : "Following"}
                              </button>
                            ) : myFollowToListedUser?.status === "pending" ? (
                              <button
                                disabled
                                className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800"
                              >
                                Request Sent
                              </button>
                            ) : (
                              <button
                                onClick={() => handleFollowBack(listedUser)}
                                disabled={followActionLoading === listedUser.id}
                                className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                              >
                                {followActionLoading === listedUser.id ? "Sending..." : "Follow back"}
                              </button>
                            )
                          )}

                          {canShowActionMenu && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenFollowMenuUserId((prev) => (prev === listedUser.id ? null : listedUser.id))
                                }
                                className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                aria-label="Open follow actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>

                              {isMenuOpen && (
                                <div className="absolute right-0 top-8 z-20 min-w-[170px] rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
                                  <button
                                    onClick={() => handleRemoveAsFollowing(listedUser.id)}
                                    disabled={followActionLoading === listedUser.id}
                                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                                  >
                                    {followActionLoading === listedUser.id ? "Updating..." : "Unfollow"}
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
        {activeTab === "stats" && (
          <div className="space-y-6">
            {statsLoading || !stats ? (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-sm text-slate-500">
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

        {activeTab === "posts" && profileUser && (
          <ProfileCinePostsPanel mode="posts" profileUserId={profileUser.id} currentUser={currentUser} />
        )}

        {activeTab === "saved-posts" && profileUser && isOwnProfile && (
          <ProfileCinePostsPanel mode="saved" profileUserId={profileUser.id} currentUser={currentUser} />
        )}

        {activeTab === "liked-posts" && profileUser && (
          <ProfileCinePostsPanel mode="liked" profileUserId={profileUser.id} currentUser={currentUser} />
        )}

        {activeTab === "lists" && profileUser && (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Lists</h2>
                <p className="text-sm text-slate-500">
                  {profileUser.name}'s lists
                </p>
              </div>
              <Link
                href="/lists"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Open lists page
              </Link>
            </div>

            {listsLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Loading lists...
              </div>
            ) : profileLists.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No lists yet.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {profileLists.map((list) => (
                  <Link
                    key={list.id}
                    href={`/lists/${list.id}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-slate-950">{list.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                          {list.description || "No description yet."}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                        {list.privacy}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {list.owner_id === profileUser.id ? "Owned" : "Collaborative"}
                      </span>
                      {list.is_ranked && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
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
          <div className="w-full max-w-2xl rounded-3xl border border-[#d8c8a6]/70 bg-[#f8f4ec] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">Import Ratings CSV</h3>
              <button
                onClick={() => setIsRatingsImportOpen(false)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            <div className="rounded-2xl border border-[#dbc9a7] bg-[#fffaf0] p-4 text-sm text-zinc-700">
              <p className="font-semibold text-zinc-900">Expected CSV columns:</p>
              <p className="mt-1">Date, Name, Year, Rating (Letterboxd URI is ignored)</p>
              <p className="mt-2">Rating mapping:</p>
              <p>0-2.5 = Bad, 3-4 = Good, 4.5-5 = Masterpiece</p>
            </div>

            <div className="mt-4">
              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[#cab995] bg-white px-4 py-10 text-center hover:bg-[#fff8e8]">
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
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-700" />
                      <p className="mt-2 text-sm font-medium text-zinc-800">Importing ratings...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto h-6 w-6 text-zinc-700" />
                      <p className="mt-2 text-sm font-medium text-zinc-800">Click to upload ratings CSV file</p>
                    </>
                  )}
                </div>
              </label>
            </div>

            {ratingsImportError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {ratingsImportError}
              </div>
            )}

            {ratingsImportSummary && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Imported {ratingsImportSummary.imported} of {ratingsImportSummary.totalRows} rows.
                {" "}Skipped {ratingsImportSummary.skipped} rows.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
