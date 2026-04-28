"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { User, MovieLogWithContent } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserByUsername, getUserStats, getFollowerCount, getFollowingCount } from "@/lib/profile";
import { getUserMovieLogs } from "@/lib/logs";
import { buildLogUrl } from "@/lib/log-url";
import { Mail, Users, Film, Star, Zap, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [recentLogs, setRecentLogs] = useState<MovieLogWithContent[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "stats">("overview");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        // Get current user
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const current: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
          bio: userData?.bio || "",
        };

        setCurrentUser(current);

        // Fetch profile user by username
        const profile = await getUserByUsername(username);
        if (!profile) {
          router.push("/404");
          return;
        }

        setProfileUser(profile);

        // Fetch stats
        const userStats = await getUserStats(profile.id);
        setStats(userStats);

        // Fetch followers/following
        const followerCount = await getFollowerCount(profile.id);
        const followingCount = await getFollowingCount(profile.id);
        setFollowers(followerCount);
        setFollowing(followingCount);

        // Fetch recent logs
        const logs = await getUserMovieLogs(profile.id, 10);
        setRecentLogs(logs);

        setLoading(false);
      } catch (error) {
        console.error("Error loading profile:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [username, router]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (loading || !currentUser || !profileUser || !stats) {
    return <CinematicLoading message="This profile is loading" />;
  }

  return (
    <PageLayout user={currentUser} onSignOut={handleSignOut}>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#f5f0de] hover:text-[#f5f0de] mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        {/* Profile Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
          <div className="flex items-start gap-6 mb-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
              {profileUser.name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-1">{profileUser.name}</h1>
              <p className="text-gray-600 mb-3">@{profileUser.username}</p>

              {profileUser.bio && (
                <p className="text-gray-700">{profileUser.bio}</p>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.totalLogged}</p>
              <p className="text-sm text-gray-600">Movies Logged</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{followers}</p>
              <p className="text-sm text-gray-600">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{following}</p>
              <p className="text-sm text-gray-600">Following</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{Number(stats?.averageRating || 0).toFixed(1)}</p>
              <p className="text-sm text-gray-600">Avg Rating</p>
            </div>
          </div>
        </div>


        {/* Tabs + View Full Calendar Button */}
        <div className="flex gap-4 border-b border-gray-200 mb-8 items-center">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "overview"
                ? "text-[#f5f0de] border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "stats"
                ? "text-[#f5f0de] border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === "logs"
                ? "text-[#f5f0de] border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Recent Logs
          </button>
          {/* Link to full calendar/logs page for this user */}
          <a
            href={`/user/${encodeURIComponent(profileUser.username)}/logs`}
            className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            title={`View ${profileUser.name}'s full calendar`}
          >
            View Full Calendar
          </a>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-3 gap-6">
            {/* Movies Logged Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-[#f5f0de] font-medium">Movies Logged</p>
                  <p className="text-3xl font-bold text-[#f5f0de] mt-1">{stats.totalLogged}</p>
                </div>
                <Film className="w-8 h-8 text-[#f5f0de]" />
              </div>
              <p className="text-xs text-[#f5f0de]">All-time total</p>
            </div>

            {/* Avg Rating Card */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-yellow-600 font-medium">Average Rating</p>
                  <p className="text-3xl font-bold text-yellow-900 mt-1">{Number(stats?.averageRating || 0).toFixed(1)}/5</p>
                </div>
                <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              </div>
              <p className="text-xs text-yellow-700">Based on {stats.totalLogged} logs</p>
            </div>

            {/* Most Common Mood Card */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Most Common Mood</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{stats.mostCommonMood || "N/A"}</p>
                </div>
                <Zap className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-xs text-purple-700">When watching movies</p>
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Detailed Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-gray-700">Total Movies Logged</span>
                  <span className="font-bold text-gray-900">{stats.totalLogged}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-gray-700">Average Rating</span>
                  <span className="font-bold text-gray-900">{Number(stats?.averageRating || 0).toFixed(1)} out of 5</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-gray-700">Most Common Mood</span>
                  <span className="font-bold text-gray-900">{stats.mostCommonMood || "Not yet recorded"}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-gray-700">Followers</span>
                  <span className="font-bold text-gray-900">{followers}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-gray-700">Following</span>
                  <span className="font-bold text-gray-900">{following}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-4">
            {recentLogs.length > 0 ? (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => router.push(buildLogUrl(log))}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="flex gap-4">
                    {log.content.poster_url && (
                      <img
                        src={log.content.poster_url}
                        alt={log.content.title}
                        className="w-16 h-24 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">{log.content.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Watched {new Date(log.watched_date).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-gray-900">
                          {log.reaction === 2 ? "Masterpiece" : log.reaction === 1 ? "Good" : "Bad"}
                        </span>
                        {log.mood && (
                          <span className="px-2 py-1 bg-blue-100 text-[#f5f0de] rounded text-xs">
                            {log.mood}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Film className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No movie logs yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
