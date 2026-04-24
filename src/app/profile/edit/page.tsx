"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { sendEmailVerification } from "firebase/auth";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { User } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, verifyBeforeUpdateEmail, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { updateUserProfile } from "@/lib/profile";
import { Loader2, ArrowLeft, Save, Upload, Camera, X } from "lucide-react";
import Link from "next/link";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

async function compressImageToDataUrl(file: File): Promise<string> {
  const sourceUrl = await readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 512;
      const maxHeight = 512;

      let { width, height } = image;
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Failed to process image."));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", 0.82);
      resolve(compressed);
    };

    image.onerror = () => reject(new Error("Failed to process image."));
    image.src = sourceUrl;
  });
}

export default function EditProfilePage() {
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [reauthError, setReauthError] = useState("");
  const [showVerifyMsg, setShowVerifyMsg] = useState(false);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    bio: "",
    avatar_url: "",
  });

  useEffect(() => {
    // Show verify message if coming from /profile/edit?verify=1
    if (typeof window !== "undefined" && window.location.search.includes("verify=1")) {
      setShowVerifyMsg(true);
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        // Fetch user profile
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")
            [0] || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
          bio: userData?.bio || "",
        };

        setUser(currentUser);
        setFormData({
          name: currentUser.name,
          username: currentUser.username,
          email: userData?.email || firebaseUser.email || "",
          bio: currentUser.bio || "",
          avatar_url: currentUser.avatar_url || "",
        });

        setLoading(false);
      } catch (error) {
        console.error("Error loading profile:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleSave = async () => {
    if (!user || !auth.currentUser) return;

    const cleanName = formData.name.trim();
    const cleanBio = formData.bio.trim();
    const cleanUsername = formData.username.trim().toLowerCase();
    const cleanEmail = formData.email.trim().toLowerCase();

    if (!cleanName) {
      setSaveError("Name is required.");
      return;
    }

    if (!cleanUsername || !/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setSaveError("Username must be 3-20 characters (letters, numbers, underscore only).");
      return;
    }

    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setSaveError("Please enter a valid email address.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      const allUsers = usersSnapshot.val() || {};
      const usernameTaken = Object.values(allUsers).some(
        (entry: any) => entry?.id !== user.id && (entry?.username || "").toLowerCase() === cleanUsername
      );

      if (usernameTaken) {
        setSaveError("This username is already taken.");
        setSaving(false);
        return;
      }

      if (auth.currentUser.email !== cleanEmail) {
        // Prevent changing to the same email
        if (auth.currentUser.email?.toLowerCase() === cleanEmail) {
          setSaveError("This is already your current email address.");
          setSaving(false);
          return;
        }
        try {
          await verifyBeforeUpdateEmail(auth.currentUser, cleanEmail);
          alert("A verification email has been sent to your new address. Please check your inbox and spam folder. If you do not receive the email within a few minutes, try resending or check your email provider's spam/junk folder.\n\nIf you still do not receive the email, please contact support or try a different email address.");
        } catch (emailError: any) {
          // Handle common Firebase errors with user-friendly messages
          if (emailError?.code === "auth/email-already-in-use") {
            setSaveError("This email address is already in use by another account.");
            setSaving(false);
            return;
          }
          if (emailError?.code === "auth/invalid-email") {
            setSaveError("Please enter a valid email address.");
            setSaving(false);
            return;
          }
          if (emailError?.code === "auth/requires-recent-login") {
            // Prompt for password and re-authenticate
            setPendingEmail(cleanEmail);
            setShowReauthModal(true);
            setSaving(false);
            return;
          }
          setSaveError(emailError?.message || "Failed to change email. Please try again.");
          setSaving(false);
          return;
        }
      }

      await updateUserProfile(user.id, {
        name: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        bio: cleanBio,
        avatar_url: formData.avatar_url,
      });

      router.push(`/profile/${cleanUsername}`);
    } catch (error) {
      console.error("Error saving profile:", error);
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("username already taken")) {
        setSaveError("This username is already taken.");
      } else {
        setSaveError("Failed to save profile. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle re-authentication and retry email change
  async function handleReauth(e: React.FormEvent) {
    e.preventDefault();
    setReauthError("");
    if (!auth.currentUser || !pendingEmail) return;
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email || "", reauthPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      setShowReauthModal(false);
      setReauthPassword("");
      setPendingEmail(null);
      setSaving(true);
      await verifyBeforeUpdateEmail(auth.currentUser, pendingEmail!);
      alert("A verification email has been sent to your new address. Please check your inbox and spam folder. If you do not receive the email within a few minutes, try resending or check your email provider's spam/junk folder.\n\nIf you still do not receive the email, please contact support or try a different email address.");
    } catch (err: any) {
      setReauthError(err?.message || "Failed to re-authenticate. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must be 5MB or smaller.");
      return;
    }

    try {
      setUploadError("");
      setUploadingAvatar(true);
      const downloadUrl = await compressImageToDataUrl(file);

      setFormData((prev) => ({
        ...prev,
        avatar_url: downloadUrl,
      }));

      try {
        await updateUserProfile(user.id, {
          avatar_url: downloadUrl,
        });

        setUser((prev) => (prev ? { ...prev, avatar_url: downloadUrl } : prev));
      } catch (saveAvatarError) {
        console.error("Error saving avatar preview to profile:", saveAvatarError);
        setUploadError("Profile photo preview is ready, but saving it failed. Try saving your profile changes once more.");
      }
    } catch (error: any) {
      console.error("Error uploading avatar:", error);

      try {
        const fallbackDataUrl = await compressImageToDataUrl(file);
        setFormData((prev) => ({
          ...prev,
          avatar_url: fallbackDataUrl,
        }));
        try {
          await updateUserProfile(user.id, {
            avatar_url: fallbackDataUrl,
          });

          setUser((prev) => (prev ? { ...prev, avatar_url: fallbackDataUrl } : prev));
          setUploadError("Profile photo saved locally.");
        } catch (saveAvatarError) {
          console.error("Error saving fallback avatar to profile:", saveAvatarError);
          setUploadError("Could not save the profile photo. Please try again.");
        }
      } catch {
        const errorMessage = typeof error?.message === "string" ? error.message : "";
        setUploadError(errorMessage || "Failed to upload image. Please try again.");
      }
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  };

  if (loading || !user) {
    return <CinematicLoading message="Your profile editor is loading" />;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      {/* Re-authentication Modal */}
      {showReauthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <form
            onSubmit={handleReauth}
            className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xs flex flex-col gap-4"
          >
            <h2 className="text-lg font-semibold mb-2">Re-authenticate</h2>
            <p className="text-sm text-neutral-700 mb-2">For security, please enter your password to change your email.</p>
            <input
              type="password"
              className="w-full rounded border border-neutral-300 px-3 py-2"
              placeholder="Password"
              value={reauthPassword}
              onChange={e => setReauthPassword(e.target.value)}
              required
              autoFocus
            />
            {reauthError && <div className="text-xs text-red-600">{reauthError}</div>}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="flex-1 rounded border border-neutral-300 px-3 py-2 text-neutral-700 hover:bg-neutral-50"
                onClick={() => { setShowReauthModal(false); setReauthPassword(""); setPendingEmail(null); }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded bg-neutral-900 px-3 py-2 text-white font-medium hover:bg-neutral-800 disabled:opacity-60"
                disabled={saving || !reauthPassword}
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="min-h-screen bg-neutral-100 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
        <Link
          href={`/profile/${user.username}`}
          className="inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Profile
        </Link>

        {showVerifyMsg && (
          <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-100 px-4 py-3 text-yellow-900">
            <span className="font-semibold">You changed your email.</span> Please check your new inbox for a verification link.
          </div>
        )}

          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl overflow-hidden">
            <div className="px-6 sm:px-8 py-5 border-b border-neutral-200 flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-neutral-900">Edit profile</h1>
              <button
                type="button"
                onClick={() => router.push(`/profile/${user.username}`)}
                className="text-neutral-500 hover:text-neutral-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-8">
              <div className="md:border-r md:border-dashed md:border-neutral-300 md:pr-8">
                <div className="flex md:block items-start gap-4 md:gap-0">
                  <div className="relative mx-auto md:mx-0 w-28 h-28 rounded-full overflow-hidden border border-neutral-300 bg-neutral-100 flex items-center justify-center">
                    {formData.avatar_url ? (
                      <img
                        src={formData.avatar_url}
                        alt={formData.name || "Profile picture"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}

                    <label className="absolute right-1 bottom-1 w-8 h-8 rounded-full bg-white border border-neutral-300 shadow-sm flex items-center justify-center cursor-pointer hover:bg-neutral-100 transition-colors">
                      {uploadingAvatar ? (
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
                      ) : (
                        <Upload className="w-4 h-4 text-neutral-700" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                        disabled={uploadingAvatar}
                      />
                    </label>
                  </div>

                  <div className="mt-4 text-center md:text-left">
                    <p className="text-base font-semibold text-neutral-900">Upload Image</p>
                    <p className="text-sm text-neutral-500">Max file size: 5MB</p>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
                      {uploadingAvatar ? "Uploading..." : "Add Image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                        disabled={uploadingAvatar}
                      />
                    </label>
                    {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {saveError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {saveError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1.5">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/\s+/g, "") })}
                    className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                    placeholder="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                    placeholder="name@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1.5">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, 500) })}
                    className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 resize-none"
                    rows={4}
                    placeholder="Tell people a little about yourself"
                  />
                  <p className="mt-1 text-xs text-neutral-500">{formData.bio.length}/500</p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <Link
                    href={`/profile/${user.username}`}
                    className="rounded-xl border border-neutral-300 px-5 py-2.5 text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-white font-medium hover:bg-neutral-800 transition-colors disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
