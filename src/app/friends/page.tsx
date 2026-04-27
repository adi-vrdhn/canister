"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import UserCard from "@/components/UserCard";
import SearchBar from "@/components/SearchBar";
import CinematicLoading from "@/components/CinematicLoading";
import { User, FollowWithUser } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  ref,
  get,
  set,
  query,
  orderByChild,
  equalTo,
  onValue,
} from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { createFollowRequestNotification } from "@/lib/notifications";
import { Users, Heart } from "lucide-react";

type TabType = "search" | "following" | "followers" | "requests";

export default function FriendsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("search");

  // User lists
  const [following, setFollowing] = useState<FollowWithUser[]>([]);
  const [followers, setFollowers] = useState<FollowWithUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FollowWithUser[]>([]);

  // Search results
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [sendingRequestTo, setSendingRequestTo] = useState<string | null>(null);

  // Set up auth listener and fetch user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }
      let currentUser: User | null = null;
      try {
        // Fetch user data from database
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          currentUser = {
            id: userData.id,
            username: userData.username,
            name: userData.name,
            avatar_url: userData.avatar_url || null,
            created_at: userData.createdAt,
          };
        } else {
          // Fallback user from auth
          currentUser = {
            id: firebaseUser.uid,
            username: firebaseUser.email?.split("@")[0] || "user",
            name: firebaseUser.displayName || "User",
            avatar_url: null,
            created_at: new Date().toISOString(),
          };
        }

        setUser(currentUser);
        setLoading(false);

        // Set up real-time listener for follows
        if (currentUser) {
          setupFollowsListener(currentUser);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const setupFollowsListener = (currentUser: User) => {
    const followsRef = ref(db, "follows");

    // Real-time listener for follows
    const unsubscribe = onValue(followsRef, async (snapshot) => {
      if (!snapshot.exists()) {
        setFollowing([]);
        setFollowers([]);
        setPendingRequests([]);
        setSentRequests(new Set());
        return;
      }

      const allFollows = snapshot.val();
      const followsList = Object.entries(allFollows).map(([id, data]: any) => ({
        id,
        ...data,
      }));

      // Fetch all users for mapping
      try {
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        const usersData = usersSnapshot.val() || {};

        const acceptedFollowing = followsList.filter(
          (f: any) =>
            f.follower_id === currentUser.id && f.status === "accepted"
        );
        const acceptedFollowers = followsList.filter(
          (f: any) =>
            f.following_id === currentUser.id && f.status === "accepted"
        );
        const pendingReceived = followsList.filter(
          (f: any) =>
            f.following_id === currentUser.id && f.status === "pending"
        );
        const pendingSent = followsList.filter(
          (f: any) => f.follower_id === currentUser.id && f.status === "pending"
        );

        // Map follows to include user data
        setFollowing(
          acceptedFollowing.map((f: any) => ({
            ...f,
            following: Object.values(usersData).find(
              (u: any) => u.id === f.following_id
            ),
          }))
        );

        setFollowers(
          acceptedFollowers.map((f: any) => ({
            ...f,
            follower: Object.values(usersData).find(
              (u: any) => u.id === f.follower_id
            ),
          }))
        );

        setPendingRequests(
          pendingReceived.map((f: any) => ({
            ...f,
            follower: Object.values(usersData).find(
              (u: any) => u.id === f.follower_id
            ),
          }))
        );

        setSentRequests(new Set(pendingSent.map((f: any) => f.following_id)));
      } catch (error) {
        console.error("Error mapping follows:", error);
      }
    });

    return unsubscribe;
  };

  const handleFollowSearch = async (query: string) => {
    try {
      if (query.length < 1) {
        setSearchResults([]);
        return [];
      }

      // Fetch all users and filter in JS
      const usersRef = ref(db, "users");
      const snapshot = await get(usersRef);

      if (!snapshot.exists()) {
        setSearchResults([]);
        return [];
      }

      const allUsers = Object.values(snapshot.val()).filter((u: any) => {
        const usernameMatch =
          u.username.toLowerCase().includes(query.toLowerCase()) ||
          u.name.toLowerCase().includes(query.toLowerCase());
        return usernameMatch && u.id !== user?.id;
      }) as User[];

      setSearchResults(allUsers.slice(0, 15));

      return allUsers.slice(0, 15).map((u: any) => ({
        id: u.id,
        title: `@${u.username}`,
        subtitle: u.name,
        image: u.avatar_url || undefined,
      }));
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      return [];
    }
  };

  const handleSendRequest = async (userId: string) => {
    if (!user || sendingRequestTo) return;

    setSendingRequestTo(userId);

    try {
      // Check if follow already exists
      const followsRef = ref(db, "follows");
      const snapshot = await get(followsRef);

      if (snapshot.exists()) {
        const follows = Object.values(snapshot.val());
        const existingFollow = follows.find(
          (f: any) =>
            f.follower_id === user.id && f.following_id === userId
        );

        if (existingFollow) {
          setSentRequests(new Set([...sentRequests, userId]));
          setSendingRequestTo(null);
          return;
        }
      }

      // Create new follow request
      const followId = `${user.id}-${userId}-${Date.now()}`;
      const createdAt = new Date().toISOString();
      await set(ref(db, `follows/${followId}`), {
        id: followId,
        follower_id: user.id,
        following_id: userId,
        status: "pending",
        createdAt,
      });

      await createFollowRequestNotification(userId, followId, user, createdAt);

      setSentRequests(new Set([...sentRequests, userId]));
    } catch (error) {
      console.error("Error sending follow request:", error);
    } finally {
      setSendingRequestTo(null);
    }
  };

  const handleAcceptFollow = async (followId: string) => {
    try {
      const followRef = ref(db, `follows/${followId}`);
      const snapshot = await get(followRef);
      if (snapshot.exists()) {
        const followData = snapshot.val();
        await set(followRef, { ...followData, status: "accepted" });
      }
    } catch (error) {
      console.error("Error accepting follow:", error);
    }
  };

  const handleUnfollow = async (followId: string) => {
    try {
      const followRef = ref(db, `follows/${followId}`);
      await set(followRef, null);
    } catch (error) {
      console.error("Error unfollowing:", error);
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

  if (loading) {
    return <CinematicLoading message="Your friends are loading" />;
  }

  if (!user) {
    return null;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="p-8">
        {/* Header */}
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Friends</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "search"
                ? "text-[#f5f0de] border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Discover
          </button>

          <button
            onClick={() => setActiveTab("following")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "following"
                ? "text-[#f5f0de] border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Following ({following.length})
          </button>

          <button
            onClick={() => setActiveTab("followers")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "followers"
                ? "text-[#f5f0de] border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Followers ({followers.length})
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors relative ${
              activeTab === "requests"
                ? "text-[#f5f0de] border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Requests
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === "search" && (
            <div>
              <div className="mb-6">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleFollowSearch(e.target.value);
                    }}
                    placeholder="Search by username or name..."
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((searchUser) => {
                    const isAlreadyFollowing = following.some((f) => f.following?.id === searchUser.id);
                    const isRequestSent = sentRequests.has(searchUser.id);
                    const isFollowingMe = followers.some((f) => f.follower?.id === searchUser.id);

                    return (
                      <div
                        key={searchUser.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            {searchUser.username[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">@{searchUser.username}</p>
                            <p className="text-xs text-gray-500">{searchUser.name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isAlreadyFollowing && (
                            <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                              Following
                            </span>
                          )}
                          {isRequestSent && !isAlreadyFollowing && (
                            <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                              Request Sent
                            </span>
                          )}
                          {isFollowingMe && !isAlreadyFollowing && (
                            <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-[#f5f0de] rounded">
                              Follows You
                            </span>
                          )}

                          {!isAlreadyFollowing && !isRequestSent && (
                            <button
                              onClick={() => handleSendRequest(searchUser.id)}
                              disabled={sendingRequestTo === searchUser.id}
                              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {sendingRequestTo === searchUser.id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                "Send Request"
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : searchQuery.length > 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No users found</p>
                  <p className="text-gray-500 text-sm mt-1">Try a different search</p>
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Search for friends</p>
                  <p className="text-gray-500 text-sm mt-1">Type a username or name to get started</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "following" && (
            <div>
              {following.length > 0 ? (
                <div className="space-y-3">
                  {following.map((follow) => (
                    <div key={follow.id} onClick={() => router.push(`/profile/${follow.following?.username}`)} style={{ cursor: 'pointer' }}>
                      <UserCard
                        user={follow.following!}
                        badge="friend"
                        onAction={() => handleUnfollow(follow.id)}
                        actionLabel="Unfollow"
                        showSubtitle
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Not following anyone</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Search and follow friends to keep up with their shares
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "followers" && (
            <div>
              {followers.length > 0 ? (
                <div className="space-y-3">
                  {followers.map((follow) => (
                    <div key={follow.id} onClick={() => router.push(`/profile/${follow.follower?.username}`)} style={{ cursor: 'pointer' }}>
                      <UserCard
                        user={follow.follower!}
                        badge="friend"
                        showSubtitle
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">
                    No followers yet
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    Share awesome movies and build your community
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "requests" && (
            <div>
              {pendingRequests.length > 0 ? (
                <div className="space-y-3">
                  {pendingRequests.map((follow) => (
                    <UserCard
                      key={follow.id}
                      user={follow.follower!}
                      badge="pending"
                      onAction={() => handleAcceptFollow(follow.id)}
                      actionLabel="Accept"
                      showSubtitle
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">
                    No pending requests
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    You're all caught up!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
