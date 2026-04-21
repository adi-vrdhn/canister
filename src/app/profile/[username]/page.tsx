// IMPORTANT: Enforce all permission checks and data validation in your backend (Firebase/Supabase rules) to prevent privilege escalation or data leaks.
// Never trust client-side checks alone for security.
// Sanitize and validate all user input server-side as well.
// Consider rate limiting and monitoring for abuse.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import DOMPurify from 'dompurify';
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, set, remove } from "firebase/database";
import { ArrowLeft, Bell, Film, Loader2, MoreHorizontal, Plus, Sparkles, Upload, Users } from "lucide-react";
import StatsInsights from "@/components/StatsInsights";
import Achievements from "@/components/Achievements";
import SearchBar from "@/components/SearchBar";
import EmailVerificationBadge from "@/components/EmailVerificationBadge";
import { auth, db } from "@/lib/firebase";
import { addToWatchlist, createMovieLog, getUserWatchlist } from "@/lib/logs";
import { getListWithDetails, getUserLists } from "@/lib/lists";
import { searchMovies } from "@/lib/tmdb";
import {
  calculateAchievements,
  getFollowerCount,
  getFollowingCount,
  getMostWatchedGenres,
  getUserByUsername,
  getUserProfile,
  getUserStats,
  updateUserProfile,
  updateMoodTags,
} from "@/lib/profile";
import type { ListWithItems, MovieLogWithContent, User } from "@/types";

type FollowModalType = "followers" | "following" | "requests";

interface SocialNotification {
  id: string;
  type: "follow_request" | "collaboration_request";
  fromUser: User;
  createdAt: string;
  listId?: string;
  listName?: string;
}

interface FollowRecord {
  id: string;
  follower_id: string;
  following_id: string;
  status: "pending" | "accepted";
  created_at?: string;
  createdAt?: string;
}

function ProfilePageInner() {
    // --- Ratings Import Modal State ---
    const [isRatingsImportOpen, setIsRatingsImportOpen] = useState(false);
    const [ratingsImportLoading, setRatingsImportLoading] = useState(false);
    const [ratingsImportError, setRatingsImportError] = useState("");
    const [ratingsImportSummary, setRatingsImportSummary] = useState<null | { totalRows: number; imported: number; skipped: number }>(null);
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;




  // --- State declarations (must be before all hooks/functions) ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCurrentUserProfile, setHasCurrentUserProfile] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mostWatchedGenres, setMostWatchedGenres] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<MovieLogWithContent[]>([]);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  // Persist notification badge state in localStorage
  const [hasUnseenNotifications, setHasUnseenNotifications] = useState(false);
  const hasOpenedNotifications = useRef(false);
  const [allFollows, setAllFollows] = useState<FollowRecord[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [displayList, setDisplayList] = useState<ListWithItems | null>(null);
  const [ownerPublicLists, setOwnerPublicLists] = useState<any[]>([]);
  const [selectedDisplayListId, setSelectedDisplayListId] = useState("");
  const [updatingDisplayList, setUpdatingDisplayList] = useState(false);

  // --- End state declarations ---

  // Notification badge persistence effect (must be after all state declarations)
  useEffect(() => {
    if (!currentUser) return;
    const NOTIF_KEY = `notif_seen_${currentUser.id}`;
    if (notifications.length === 0) {
      setHasUnseenNotifications(false);
      return;
    }
    const lastSeen = typeof window !== "undefined" ? localStorage.getItem(NOTIF_KEY) : null;
    const latest = notifications[0]?.createdAt;
    if (latest && lastSeen !== latest) {
      setHasUnseenNotifications(true);
    } else {
      setHasUnseenNotifications(false);
    }
  }, [notifications, currentUser]);

  const hardRedirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  // Place this after state declarations
  const handleClearAllNotifications = async () => {
    if (!isOwnProfile || notifications.length === 0) return;
    try {
      for (const notif of notifications) {
        if (notif.type === "follow_request") {
          await remove(ref(db, `follows/${notif.id}`));
        } else if (notif.type === "collaboration_request") {
          await remove(ref(db, `list_collaborators/${notif.id.replace('collab-', '')}`));
        }
      }
      setNotifications([]);
      setHasUnseenNotifications(false);
      // Also update localStorage badge
      if (currentUser && typeof window !== "undefined") {
        localStorage.setItem(`notif_seen_${currentUser.id}`, "cleared");
      }
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const [activeTab, setActiveTab] = useState<string>("friends");
  const [followModalType, setFollowModalType] = useState<FollowModalType>("followers");
  const [followSearch, setFollowSearch] = useState("");
  const [openFollowMenuUserId, setOpenFollowMenuUserId] = useState<string | null>(null);
  const [followActionLoading, setFollowActionLoading] = useState<string | null>(null);
  const [profileFollowActionLoading, setProfileFollowActionLoading] = useState(false);
  const [isWatchlistSearchOpen, setIsWatchlistSearchOpen] = useState(false);
  const [watchlistModalError, setWatchlistModalError] = useState("");
  const [profilePageError, setProfilePageError] = useState<string | null>(null);
  const [followRequestError, setFollowRequestError] = useState<string | null>(null);
  const [displayListError, setDisplayListError] = useState<string | null>(null);
  const [watchlistModalLoading, setWatchlistModalLoading] = useState(false);
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
          console.log('[PROFILE] User not found after all attempts.');
          setProfilePageError("User not found.");
          setLoading(false);
          return;
        }
        setProfileUser(profileUserObj);
        console.log('[PROFILE] Profile user set:', profileUserObj);

        // Fetch stats
        const statsObj = await getUserStats(profileUserObj.id);
        setStats(statsObj);
        console.log('[PROFILE] Stats:', statsObj);

        // Fetch friends (followers/following)
        const followerCountVal = await getFollowerCount(profileUserObj.id);
        setFollowerCount(followerCountVal);
        const followingCountVal = await getFollowingCount(profileUserObj.id);
        setFollowingCount(followingCountVal);
        console.log('[PROFILE] Follower count:', followerCountVal, 'Following count:', followingCountVal);

        // Fetch followers and following user arrays
        // Followers: users who follow this profile
        const followersSnap = await get(ref(db, `follows`));
        const allFollowsRaw = followersSnap.exists() ? Object.values(followersSnap.val()) : [];
        // Followers: those whose following_id === profileUserObj.id && status === 'accepted'
        const followerUserIds = allFollowsRaw
          .filter((f: any) => f.following_id === profileUserObj.id && f.status === 'accepted')
          .map((f: any) => f.follower_id);
        // Following: those whose follower_id === profileUserObj.id && status === 'accepted'
        const followingUserIds = allFollowsRaw
          .filter((f: any) => f.follower_id === profileUserObj.id && f.status === 'accepted')
          .map((f: any) => f.following_id);

        // Fetch user objects for followers and following
        const usersSnap = await get(ref(db, `users`));
        const allUsersRaw = usersSnap.exists() ? usersSnap.val() : {};
        const followersArr = followerUserIds.map((uid: string) => allUsersRaw[uid]).filter(Boolean);
        const followingArr = followingUserIds.map((uid: string) => allUsersRaw[uid]).filter(Boolean);
        setFollowers(followersArr);
        setFollowing(followingArr);
        setAllFollows(allFollowsRaw);

        // Fetch most watched genres
        const genres = await getMostWatchedGenres(profileUserObj.id);
        setMostWatchedGenres(genres);
        console.log('[PROFILE] Most watched genres:', genres);

        // Fetch achievements
        const ach = await calculateAchievements(profileUserObj.id);
        setAchievements(ach);
        console.log('[PROFILE] Achievements:', ach);

        // Fetch watchlist
        const watchlistData = await getUserWatchlist(profileUserObj.id);
        setWatchlist(watchlistData);
        console.log('[PROFILE] Watchlist:', watchlistData);

        // Fetch notifications if own profile
        if (username === currentUserObj.username) {
          // Example: fetch notifications from db (implement as needed)
          // setNotifications(await getUserNotifications(profileUserObj.id));
          console.log('[PROFILE] (Own profile) Would fetch notifications here.');
        }

        // Fetch lists
        const lists = await getUserLists(profileUserObj.id);
        setOwnerPublicLists(lists.filter((l: any) => l.privacy === "public"));
        console.log('[PROFILE] Public lists:', lists.filter((l: any) => l.privacy === "public"));

        // Persist and reload connected display list if present
        if (profileUserObj.display_list_id) {
          try {
            const connected = await getListWithDetails(profileUserObj.display_list_id);
            setDisplayList(connected && connected.privacy === "public" ? connected : null);
            setSelectedDisplayListId(profileUserObj.display_list_id);
          } catch (err) {
            setDisplayList(null);
          }
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
    if (!isOwnProfile && activeTab === "notifications") {
      setActiveTab("stats");
    }
    // Mark notifications as seen when notifications tab is opened
    if (isOwnProfile && activeTab === "notifications" && hasUnseenNotifications && currentUser && notifications.length > 0) {
      setHasUnseenNotifications(false);
      hasOpenedNotifications.current = true;
      // Persist last seen notification marker
      const NOTIF_KEY = `notif_seen_${currentUser.id}`;
      if (typeof window !== "undefined") {
        localStorage.setItem(NOTIF_KEY, notifications[0].createdAt);
      }
    }
  }, [isOwnProfile, activeTab, hasUnseenNotifications, notifications, currentUser]);

  useEffect(() => {
    setOpenFollowMenuUserId(null);
  }, [activeTab, followModalType]);

  useEffect(() => {
    if (!isOwnProfile && followModalType === "requests") {
      setFollowModalType("followers");
    }
  }, [isOwnProfile, followModalType]);

  // Email removed from profile for privacy

  const currentlyIntoText = useMemo(() => {
    if (!profileUser?.mood_tags || profileUser.mood_tags.length === 0) {
      return "Not set yet";
    }
    return profileUser.mood_tags.join(", ");
  }, [profileUser]);

  const shownUsers = useMemo(() => {
    if (followModalType === "requests") {
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
  const followMenuActionLabel = followModalType === "following" ? "Remove as following" : "Stop Following";

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

  const removeFollowRecord = async (followId: string) => {
    await set(ref(db, `follows/${followId}`), null);
    setAllFollows((prev) => prev.filter((follow) => follow.id !== followId));
  };

  const handleSendFollowRequest = async () => {
    if (!currentUser || !profileUser || isOwnProfile || profileFollowActionLoading) return;
    setFollowRequestError(null);
    try {
      setProfileFollowActionLoading(true);
      if (viewerToProfileFollow) {
        return;
      }
      const followId = `${currentUser.id}-${profileUser.id}-${Date.now()}`;
      const createdAt = new Date().toISOString();
      await set(ref(db, `follows/${followId}`), {
        id: followId,
        follower_id: currentUser.id,
        following_id: profileUser.id,
        status: "pending",
        created_at: createdAt,
        createdAt,
      });
      setAllFollows((prev) => [
        ...prev,
        {
          id: followId,
          follower_id: currentUser.id,
          following_id: profileUser.id,
          status: "pending",
          created_at: createdAt,
          createdAt,
        },
      ]);
    } catch (error) {
      setFollowRequestError("Failed to send follow request. Please try again.");
    } finally {
      setProfileFollowActionLoading(false);
    }
  };

  const handleAcceptFollowRequest = async (note: SocialNotification) => {
    const followRecord = allFollows.find((follow) => follow.id === note.id);
    if (!followRecord) return;

    try {
      const updatedFollow: FollowRecord = { ...followRecord, status: "accepted" };
      await set(ref(db, `follows/${note.id}`), updatedFollow);

      setAllFollows((prev) => prev.map((follow) => (follow.id === note.id ? updatedFollow : follow)));
      setNotifications((prev) => prev.filter((notification) => notification.id !== note.id));
      setHasUnseenNotifications((prev) => (followRequests.length > 1 ? prev : false));

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
      setNotifications((prev) => prev.filter((notification) => notification.id !== followId));
      setHasUnseenNotifications((prev) => (followRequests.length > 1 ? prev : false));
    } catch (error) {
      console.error("Error declining follow request:", error);
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

  const handleMoviesLoggedClick = () => {
    if (!profileUser) return;
    if (isOwnProfile) {
      router.push("/logs");
      return;
    }
    router.push(`/user/${profileUser.username}/logs`);
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

  const handleWatchlistSearch = async (query: string) => {
    const results = await searchMovies(query, 1);

    return results.slice(0, 10).map((movie) => ({
      id: movie.id,
      originalId: movie.id,
      title: movie.title,
      subtitle: movie.release_date
        ? `${movie.release_date.split("-")[0]} • ${movie.vote_average?.toFixed(1) || "N/A"}/10`
        : `Rating ${movie.vote_average?.toFixed(1) || "N/A"}/10`,
      image: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : undefined,
      type: "movie",
    }));
  };

  const handleAddMovieToWatchlist = async (item: {
    id: string | number;
    originalId?: number;
    title: string;
  }) => {
    if (!currentUser || !profileUser || !isOwnProfile) return;
    setWatchlistModalError("");
    try {
      const movieId = Number(item.originalId ?? item.id);
      if (!movieId) return;
      const alreadyAdded = watchlist.some(
        (entry) => entry.content_type === "movie" && entry.content_id === movieId
      );
      if (alreadyAdded) {
        setWatchlistModalError("This movie is already in your watchlist.");
        return;
      }
      setWatchlistModalLoading(true);
      await addToWatchlist(currentUser.id, movieId, "movie");
      const updatedWatchlist = await getUserWatchlist(profileUser.id);
      setWatchlist(updatedWatchlist);
      setIsWatchlistSearchOpen(false);
    } catch (error) {
      setWatchlistModalError("Failed to add movie. Please try again.");
    } finally {
      setWatchlistModalLoading(false);
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

  if (loading || !profileUser || !stats) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#090b12]">
        <Loader2 className="h-12 w-12 animate-spin text-[#d6b470]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090b12] pb-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-24 h-72 w-72 rounded-full bg-[#c89d4a]/20 blur-3xl" />
        <div className="absolute right-0 top-56 h-80 w-80 rounded-full bg-[#40527f]/30 blur-3xl" />
        <div className="absolute bottom-8 left-1/4 h-64 w-64 rounded-full bg-[#723d5f]/20 blur-3xl" />
      </div>
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
      <div className="relative z-10 mx-auto w-full max-w-7xl pt-3">
        <EmailVerificationBadge />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-10 mt-8 flex flex-col items-center gap-3 text-center">
          <p className="rounded-full border border-[#d6b470]/40 bg-[#d6b470]/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#f1d39a]">
            Cinematic Profile
          </p>
          <h1
            className="text-4xl font-semibold uppercase tracking-[0.18em] text-[#f8e9c8] sm:text-5xl"
            style={{ fontFamily: '"Bodoni Moda", "Playfair Display", "Times New Roman", serif' }}
          >
            CANISTER
          </h1>
          <p className="text-sm text-zinc-300 sm:text-base">A movie-first space for stories, taste, and timeless frames.</p>
        </div>
        <div className="mb-8 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>

          {isOwnProfile && (
            <Link
              href="/profile/edit"
              className="rounded-full border border-[#d6b470]/40 bg-[#d6b470]/15 px-4 py-2 text-sm font-medium text-[#f3ddb1] transition hover:bg-[#d6b470]/25"
            >
              Edit Profile
            </Link>
          )}
        </div>

        <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-[#d6b470]/25 bg-gradient-to-br from-[#111826]/95 via-[#151f34]/95 to-[#1f1b2e]/95 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.45)] sm:p-8">
          <div className="pointer-events-none absolute -right-10 top-0 h-48 w-48 rounded-full bg-[#f1d39a]/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-16 h-40 w-40 rounded-full bg-[#7e9cd6]/20 blur-3xl" />
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              {profileUser.avatar_url ? (
                <img
                  src={profileUser.avatar_url}
                  alt={profileUser.name}
                  className="h-20 w-20 rounded-full border-2 border-[#f1d39a]/65 object-cover shadow-[0_0_30px_rgba(214,180,112,0.35)] sm:h-24 sm:w-24"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#f1d39a]/65 bg-[#1d2233] text-2xl font-semibold text-[#f8e9c8] shadow-[0_0_30px_rgba(214,180,112,0.35)] sm:h-24 sm:w-24 sm:text-3xl">
                  {profileUser.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <h1
                  className="text-2xl font-semibold tracking-tight text-[#f8e9c8] sm:text-4xl"
                  style={{ fontFamily: '"Bodoni Moda", "Playfair Display", "Times New Roman", serif' }}
                >
                  {DOMPurify.sanitize(profileUser.name)}
                </h1>
                <p className="mt-1 inline-flex rounded-full border border-[#d6b470]/35 bg-[#d6b470]/10 px-3 py-1 text-xs font-medium tracking-wide text-[#f1d39a] sm:text-sm">
                  @{DOMPurify.sanitize(profileUser.username)}
                </p>
                {/* Email removed for privacy */}
                {profileUser.bio && <p className="mt-3 max-w-2xl text-zinc-200">{DOMPurify.sanitize(profileUser.bio)}</p>}
                <p className="mt-3 text-sm text-zinc-300">
                  <span className="font-semibold text-[#f8e9c8]">Now screening in their mood:</span>{" "}
                  {DOMPurify.sanitize(currentlyIntoText)}
                </p>
              </div>
            </div>

            <div className="grid w-full max-w-md grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={handleMoviesLoggedClick}
                className="rounded-2xl border border-[#d6b470]/25 bg-white/10 px-3 py-3 text-left backdrop-blur transition hover:bg-white/20"
              >
                <p className="text-xl font-bold text-[#f8e9c8]">{stats.totalLogged}</p>
                <p className="text-xs text-zinc-300">Movies Logged</p>
              </button>
              <button
                onClick={() => {
                  setActiveTab("friends");
                  setFollowModalType("followers");
                }}
                className="rounded-2xl border border-[#d6b470]/25 bg-white/10 px-3 py-3 text-left backdrop-blur transition hover:bg-white/20"
              >
                <p className="text-xl font-bold text-[#f8e9c8]">{followerCount}</p>
                <p className="text-xs text-zinc-300">Followers</p>
              </button>
              <button
                onClick={() => {
                  setActiveTab("friends");
                  setFollowModalType("following");
                }}
                className="rounded-2xl border border-[#d6b470]/25 bg-white/10 px-3 py-3 text-left backdrop-blur transition hover:bg-white/20"
              >
                <p className="text-xl font-bold text-[#f8e9c8]">{followingCount}</p>
                <p className="text-xs text-zinc-300">Following</p>
              </button>
              {!isOwnProfile && hasCurrentUserProfile && (
                <div className="col-span-3 flex items-center justify-end gap-2">
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
                        className="rounded-xl border border-emerald-300/35 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() =>
                          profileToViewerPendingFollow &&
                          handleDeclineFollowRequest(profileToViewerPendingFollow.id)
                        }
                        disabled={profileFollowActionLoading}
                        className="rounded-xl border border-rose-300/35 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleSendFollowRequest}
                      disabled={isFollowingProfile || isFollowRequestSent || profileFollowActionLoading}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        isFollowingProfile
                          ? "bg-emerald-500/30 text-emerald-100"
                          : isFollowRequestSent
                          ? "bg-amber-500/25 text-amber-100"
                          : "border border-[#d6b470]/35 bg-[#d6b470]/15 text-[#f7ddb0] hover:bg-[#d6b470]/25"
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {isFollowingProfile ? "Following" : isFollowRequestSent ? "Request Sent" : "Follow"}
                    </button>
                  )}
                </div>
              )}
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => router.push(`/profile/${profileUser.username}/movie-personality`)}
                    className="col-span-3 rounded-2xl border border-white/25 bg-gradient-to-r from-white/15 to-white/5 px-4 py-3 text-left transition hover:from-white/20 hover:to-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#f1d39a]" />
                      <p className="text-sm font-semibold text-[#f8e9c8]">Your Movie Personality</p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-300">Open your cinematic taste identity profile</p>
                  </button>

                  <button
                    onClick={() => {
                      setRatingsImportError("");
                      setRatingsImportSummary(null);
                      setIsRatingsImportOpen(true);
                    }}
                    className="col-span-3 rounded-2xl border border-white/25 bg-gradient-to-r from-[#4f7467]/30 to-[#2d5d66]/30 px-4 py-3 text-left transition hover:from-[#4f7467]/45 hover:to-[#2d5d66]/45"
                  >
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-[#f1d39a]" />
                      <p className="text-sm font-semibold text-[#f8e9c8]">Import Ratings CSV</p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-300">Upload your ratings export and auto-build your diary</p>
                  </button>
                </>
              ) : hasCurrentUserProfile ? (
                <div className="col-span-3 grid grid-cols-2 gap-3">
                  <Link
                    href={`/profile/${profileUser.username}/shared-movies`}
                    className="flex min-h-[96px] flex-col justify-between rounded-2xl border border-white/25 bg-gradient-to-br from-[#2f4963]/45 to-[#1f6075]/45 px-4 py-3 text-left transition hover:from-[#2f4963]/55 hover:to-[#1f6075]/55"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#f8e9c8]">Movies Shared Between You</p>
                      <p className="mt-1 text-xs text-zinc-300">
                        See movies and shows both of you have watched or loved.
                      </p>
                    </div>
                    <p className="text-xs font-medium text-[#d8c8a6]">Open shared movies</p>
                  </Link>

                  <Link
                    href={`/movie-matcher/${profileUser.username}`}
                    className="flex min-h-[96px] flex-col justify-between rounded-2xl border border-white/25 bg-gradient-to-br from-[#3b376a]/45 to-[#513067]/45 px-4 py-3 text-left transition hover:from-[#3b376a]/55 hover:to-[#513067]/55"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#f8e9c8]">Movie Matcher</p>
                      <p className="mt-1 text-xs text-zinc-300">
                        Open the full taste match report between both profiles.
                      </p>
                    </div>
                    <p className="text-xs font-medium text-[#d8c8a6]">View match report</p>
                  </Link>
                </div>
              ) : (
                <div className="col-span-3 rounded-2xl border border-dashed border-white/30 bg-white/10 px-4 py-5 text-center text-sm text-zinc-200">
                  Build your profile first to compare taste with other users.
                </div>
              )}
            </div>
          </div>
        </section>

        {(displayList || isOwnProfile) && (
          <section className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/20 bg-gradient-to-br from-[#111826]/95 via-[#15233a]/95 to-[#1f1b2e]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:p-8">
            <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-[#f1d39a]/15 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-16 h-44 w-44 rounded-full bg-[#7092d4]/15 blur-3xl" />
            <div className="relative z-10 mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="inline-flex rounded-full border border-[#d6b470]/35 bg-[#d6b470]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#f1d39a]">
                  Featured Collection
                </p>
                {displayList && (
                  <h2
                    className="mt-2 text-2xl font-semibold text-[#f8e9c8]"
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
                    className="rounded-full border border-[#d6b470]/40 bg-[#d6b470]/15 px-4 py-2 text-sm font-semibold text-[#f7ddb0] transition hover:bg-[#d6b470]/25"
                  >
                    View full list
                  </Link>
                )}
                {isOwnProfile && displayList && (
                  <button
                    onClick={handleClearDisplayList}
                    disabled={updatingDisplayList}
                    className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/20 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {displayList ? (
              <div className="relative z-10">
                <p className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-zinc-300">
                  {displayList.items.length} title{displayList.items.length === 1 ? "" : "s"} in spotlight
                </p>
                {displayList.items.length > 0 ? (
                  <div className="-mx-1 overflow-x-auto px-1 pb-2">
                    <div className="flex gap-4">
                      {displayList.items.slice(0, 10).map((item) => {
                        const title = item.content?.title || "Untitled";
                        const releaseYear = (
                          item.content?.release_date ||
                          (item.content as any)?.first_air_date ||
                          ""
                        )
                          .split("-")
                          .filter(Boolean)[0];

                        return (
                          <Link
                            key={item.id}
                            href={item.content_type === "movie" ? `/movie/${item.content_id}` : `/tv/${item.content_id}`}
                            className="group w-[180px] shrink-0"
                          >
                            <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-[#1a2133] shadow-[0_12px_35px_rgba(0,0,0,0.4)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_45px_rgba(0,0,0,0.52)]">
                              {item.content?.poster_url ? (
                                <img
                                  src={item.content.poster_url}
                                  alt={title}
                                  className="aspect-[2/3] w-full object-cover"
                                />
                              ) : (
                                <div className="flex aspect-[2/3] w-full items-center justify-center bg-gradient-to-br from-[#2f3f61] to-[#1d2740] text-xs text-zinc-200">
                                  No poster
                                </div>
                              )}
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 to-transparent" />
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-semibold text-[#f8e9c8] group-hover:text-[#f1d39a]">
                              {title}
                            </p>
                            <p className="text-xs text-zinc-300">
                              {releaseYear || "Unknown year"} • {item.content_type === "movie" ? "Movie" : "TV"}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/30 bg-white/10 p-8 text-center text-zinc-200">
                    This list has no movies yet.
                  </div>
                )}
              </div>
            ) : isOwnProfile ? (
              <div className="relative z-10 rounded-2xl border border-dashed border-white/30 bg-white/10 p-5">
                <p className="mb-3 text-sm font-medium text-zinc-100">
                  Connect one of your public lists to feature it on your profile.
                </p>

                {ownerPublicLists.length > 0 ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                      title="Select an option"
                      value={selectedDisplayListId}
                      onChange={(e) => setSelectedDisplayListId(e.target.value)}
                      className="w-full rounded-xl border border-white/30 bg-[#0f1627]/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-[#d6b470] sm:max-w-sm"
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
                      className="rounded-xl border border-[#d6b470]/40 bg-[#d6b470]/15 px-4 py-2 text-sm font-semibold text-[#f7ddb0] transition hover:bg-[#d6b470]/25 disabled:opacity-50"
                    >
                      {updatingDisplayList ? "Connecting..." : "Connect List"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-zinc-300">You have no public lists to connect.</p>
                    <Link
                      href="/lists"
                      className="text-sm font-medium text-[#f1d39a] hover:text-[#f8e9c8]"
                    >
                      Go to Lists
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        )}

        <section className="mb-6 rounded-2xl border border-white/15 bg-white/5 p-2 shadow-[0_14px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className={`grid gap-2 ${isOwnProfile ? "grid-cols-4" : "grid-cols-3"}`}>
            <button
              onClick={() => setActiveTab("friends")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === "friends" ? "bg-[#d6b470] text-[#111826]" : "text-zinc-100 hover:bg-white/15"
              }`}
            >
              Friends
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === "stats" ? "bg-[#d6b470] text-[#111826]" : "text-zinc-100 hover:bg-white/15"
              }`}
            >
              Stats
            </button>
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === "watchlist" ? "bg-[#d6b470] text-[#111826]" : "text-zinc-100 hover:bg-white/15"
              }`}
            >
              Watchlist
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab("notifications")}
                className={`relative rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  activeTab === "notifications" ? "bg-[#d6b470] text-[#111826]" : "text-zinc-100 hover:bg-white/15"
                }`}
              >
                Notifications
                {hasUnseenNotifications && (
                  <span className="absolute top-2 right-2 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
            )}
          </div>
        </section>

        {activeTab === "friends" && (
          <div className="space-y-6">
            <div className="mb-4 flex flex-wrap gap-4">
              <button
                onClick={() => setFollowModalType("followers")}
                className={`rounded-xl px-4 py-2 font-semibold transition ${followModalType === "followers" ? "bg-[#d6b470] text-[#111826]" : "bg-white/10 text-zinc-100 hover:bg-white/20"}`}
              >
                {followerCount} Followers
              </button>
              <button
                onClick={() => setFollowModalType("following")}
                className={`rounded-xl px-4 py-2 font-semibold transition ${followModalType === "following" ? "bg-[#d6b470] text-[#111826]" : "bg-white/10 text-zinc-100 hover:bg-white/20"}`}
              >
                {followingCount} Following
              </button>
              {isOwnProfile && (
                <button
                  onClick={() => setFollowModalType("requests")}
                  className={`relative rounded-xl px-4 py-2 font-semibold transition ${
                    followModalType === "requests"
                      ? "bg-[#d6b470] text-[#111826]"
                      : "bg-white/10 text-zinc-100 hover:bg-white/20"
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
              {followModalType !== "requests" && (
                <input
                  value={followSearch}
                  onChange={e => setFollowSearch(e.target.value)}
                  placeholder={`Search ${followModalType}...`}
                  className="ml-0 min-w-[180px] flex-1 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-300/70 focus:ring-2 focus:ring-[#d6b470]"
                />
              )}
            </div>
            {followModalType === "requests" && isOwnProfile ? (
              <section className="space-y-6 rounded-[2rem] border border-[#d8c8a6]/70 bg-[#f8f4ec] p-6 shadow-[0_18px_45px_rgba(6,9,16,0.25)]">
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-zinc-700" />
                  <h2 className="text-lg font-bold text-zinc-900">Friend Requests</h2>
                </div>
                {followRequests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#cab995] bg-[#fffaf0] p-10 text-center text-zinc-600">
                    No incoming friend requests.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followRequests.map((note) => (
                      <div
                        key={note.id}
                        className="flex items-center justify-between rounded-2xl border border-[#dbc9a7] bg-white px-4 py-3"
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
            ) : (
              <div className="space-y-3">
                {shownUsers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/30 bg-white/10 p-8 text-center text-sm text-zinc-200">
                    No users found.
                  </div>
                ) : (
                  shownUsers.map((listedUser) => {
                    const isMenuOpen = openFollowMenuUserId === listedUser.id;
                    const canShowActionMenu =
                      isOwnProfile &&
                      !!getMyAcceptedFollowRecordToUser(listedUser.id) &&
                      (followModalType === "following" || followModalType === "followers");

                    return (
                      <div
                        key={listedUser.id}
                        className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3 transition hover:bg-white/20"
                      >
                        <Link href={`/profile/${listedUser.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                          {listedUser.avatar_url ? (
                            <img src={listedUser.avatar_url} alt={listedUser.name} className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                              {listedUser.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-100">{listedUser.name}</p>
                            <p className="truncate text-xs text-zinc-300">@{listedUser.username}</p>
                          </div>
                        </Link>

                        <div className="ml-3 flex items-center gap-2">
                          <Users className="h-4 w-4 text-zinc-300" />

                          {canShowActionMenu && (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenFollowMenuUserId((prev) => (prev === listedUser.id ? null : listedUser.id))
                                }
                                className="rounded-full p-1 text-zinc-300 hover:bg-white/15 hover:text-zinc-100"
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
                                    {followActionLoading === listedUser.id ? "Updating..." : followMenuActionLabel}
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
        )}
        {activeTab === "stats" && (
          <div className="space-y-6">
            <StatsInsights
              genres={mostWatchedGenres}
              masterpieceCount={stats.masterpieceCount}
              goodCount={stats.goodCount}
              badCount={stats.badCount}
              totalWatched={stats.totalLogged}
              onStatClick={handleStatDrillDown}
            />
          </div>
        )}

        {activeTab === "watchlist" && (
          <section className="rounded-[2rem] border border-[#d8c8a6]/70 bg-[#f8f4ec] p-6 shadow-[0_18px_45px_rgba(6,9,16,0.25)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-zinc-700" />
                <h2 className="text-lg font-bold text-zinc-900">Watchlist</h2>
              </div>

              {isOwnProfile && (
                <button
                  onClick={() => {
                    setWatchlistModalError("");
                    setIsWatchlistSearchOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  <Plus className="h-4 w-4" />
                  Add Movies
                </button>
              )}
            </div>

            {watchlist.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cab995] bg-[#fffaf0] p-10 text-center text-zinc-600">
                No titles in watchlist yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {watchlist.map((item, index) => (
                  <Link
                    key={`${item.content_type}-${item.content_id}-${item.watched_date || index}`}
                    href={item.content_type === "movie" ? `/movie/${item.content_id}` : `/tv/${item.content_id}`}
                    className="group rounded-2xl border border-[#ddcba8] bg-white p-2 transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    {item.content.poster_url ? (
                      <img
                        src={item.content.poster_url}
                        alt={item.content.title}
                        className="aspect-[2/3] w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-gray-100 text-xs text-zinc-500">
                        No poster
                      </div>
                    )}
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-900 group-hover:text-zinc-700">
                      {item.content.title}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {isOwnProfile && activeTab === "notifications" && (
          <section className="space-y-6 rounded-[2rem] border border-[#d8c8a6]/70 bg-[#f8f4ec] p-6 shadow-[0_18px_45px_rgba(6,9,16,0.25)]">
            {notifications.length > 0 && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleClearAllNotifications}
                  className="rounded-lg bg-red-100 text-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-200 border border-red-200"
                >
                  Clear All Notifications
                </button>
              </div>
            )}
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-zinc-700" />
              <h2 className="text-lg font-bold text-zinc-900">Notifications</h2>
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cab995] bg-[#fffaf0] p-10 text-center text-zinc-600">
                No new notifications.
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((note) => (
                  <Link
                    key={note.id}
                    href={
                      note.type === "collaboration_request" && note.listId
                        ? `/lists/${note.listId}`
                        : `/profile/${note.fromUser.username}`
                    }
                    className="flex items-center justify-between rounded-2xl border border-[#dbc9a7] bg-white px-4 py-3 transition hover:bg-[#fff8e8]"
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
                          {note.type === "follow_request" ? (
                            <>
                              <span className="font-semibold">{note.fromUser.name}</span> requested to follow you.
                            </>
                          ) : (
                            <>
                              <span className="font-semibold">{note.fromUser.name}</span> sent you a collaboration
                              request for <span className="font-semibold">{note.listName}</span>.
                            </>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500">
                          @{note.fromUser.username}
                          {note.type === "collaboration_request" ? " • Tap to open list" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">{new Date(note.createdAt).toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            )}

            <Achievements achievements={achievements} />
          </section>
        )}
      </div>
      {/* Add extra whitespace at the bottom for visual comfort */}
      <div className="h-12 sm:h-20" />


      {isWatchlistSearchOpen && isOwnProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[#d8c8a6]/70 bg-[#f8f4ec] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">Add movies to watchlist</h3>
              <button
                onClick={() => setIsWatchlistSearchOpen(false)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            <p className="mb-4 text-sm text-zinc-600">
              Search for a movie and select it to add instantly.
            </p>

            <SearchBar
              placeholder="Search movie titles..."
              onSearch={handleWatchlistSearch}
              onSelect={handleAddMovieToWatchlist}
              disabled={watchlistModalLoading}
            />

            {watchlistModalError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {watchlistModalError}
              </div>
            )}
          </div>
        </div>
      )}

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
  );
}

export default function ProfilePage() {
  return (
    <ErrorBoundary>
      <ProfilePageInner />
    </ErrorBoundary>
  );
}
