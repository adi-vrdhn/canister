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
    avatar_scale: 1,
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
          avatar_scale: typeof userData?.avatar_scale === "number" ? userData.avatar_scale : 1,
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
          avatar_scale: currentUser.avatar_scale || 1,
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
        avatar_scale: formData.avatar_scale,
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
          avatar_scale: formData.avatar_scale,
        });

        setUser((prev) => (prev ? { ...prev, avatar_url: downloadUrl, avatar_scale: formData.avatar_scale } : prev));
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
            avatar_scale: formData.avatar_scale,
          });

          setUser((prev) => (prev ? { ...prev, avatar_url: fallbackDataUrl, avatar_scale: formData.avatar_scale } : prev));
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <form
            onSubmit={handleReauth}
            className="flex w-full max-w-xs flex-col gap-4 border border-white/10 bg-[#111111] p-6 text-[#f5f0de] shadow-2xl"
          >
            <h2 className="mb-2 text-lg font-black text-[#f5f0de]">Re-authenticate</h2>
            <p className="mb-2 text-sm leading-6 text-[#f5f0de]/60">For security, please enter your password to change your email.</p>
            <input
              type="password"
              className="w-full border border-white/10 bg-black px-3 py-2 text-[#f5f0de] outline-none placeholder:text-white/30 focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]"
              placeholder="Password"
              value={reauthPassword}
              onChange={e => setReauthPassword(e.target.value)}
              required
              autoFocus
            />
            {reauthError && <div className="text-xs text-[#ffb36b]">{reauthError}</div>}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="flex-1 border border-white/10 px-3 py-2 text-[#f5f0de] transition hover:bg-white/5"
                onClick={() => { setShowReauthModal(false); setReauthPassword(""); setPendingEmail(null); }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#ff7a1a] px-3 py-2 font-black text-black transition hover:bg-[#ff8d3b] disabled:opacity-60"
                disabled={saving || !reauthPassword}
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="min-h-screen bg-[#0a0a0a] p-4 text-[#f5f0de] sm:p-8">
        <div className="mx-auto max-w-4xl">
        <Link
          href={`/profile/${user.username}`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#ffb36b] hover:text-[#ff7a1a]"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Profile
        </Link>

        {showVerifyMsg && (
          <div className="mb-6 border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-4 py-3 text-sm text-[#f5f0de]">
            <span className="font-black text-[#ffb36b]">You changed your email.</span> Please check your new inbox for a verification link.
          </div>
        )}

          <div className="overflow-hidden border border-white/10 bg-[#111111] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
              <h1 className="text-2xl font-black text-[#f5f0de]">Edit profile</h1>
              <button
                type="button"
                onClick={() => router.push(`/profile/${user.username}`)}
                className="text-white/45 transition hover:text-[#f5f0de]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-8 p-6 sm:p-8 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="md:border-r md:border-dashed md:border-white/10 md:pr-8">
                <div className="flex items-start gap-4 md:block md:gap-0">
                  <div className="relative mx-auto flex h-28 w-28 items-center justify-center overflow-hidden border border-white/10 bg-black md:mx-0">
                    <div
                      className="h-full w-full"
                      style={{
                        transform: `scale(${formData.avatar_scale || 1})`,
                        transformOrigin: "center",
                      }}
                    >
                      {formData.avatar_url ? (
                        <img
                          src={formData.avatar_url}
                          alt={formData.name || "Profile picture"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white/35">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    <label className="absolute bottom-1 right-1 flex h-8 w-8 cursor-pointer items-center justify-center border border-white/10 bg-[#ff7a1a] text-black transition hover:bg-[#ff8d3b]">
                      {uploadingAvatar ? (
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                      ) : (
                        <Upload className="w-4 h-4 text-black" />
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
                    <p className="text-base font-black text-[#f5f0de]">Upload Image</p>
                    <p className="text-sm text-[#f5f0de]/55">Max file size: 5MB</p>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10">
                      {uploadingAvatar ? "Uploading..." : "Add Image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                        disabled={uploadingAvatar}
                      />
                    </label>
                    {uploadError && <p className="mt-2 text-xs text-[#ffb36b]">{uploadError}</p>}

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-[#f5f0de]">Avatar size</span>
                        <span className="text-[#ffb36b]">{Math.round((formData.avatar_scale || 1) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="1.4"
                        step="0.01"
                        value={formData.avatar_scale}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            avatar_scale: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#ff7a1a]"
                      />
                      <p className="mt-1 text-xs text-[#f5f0de]/45">
                        Smaller values zoom out. Larger values zoom in.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {saveError && (
                  <div className="border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-3 py-2 text-sm text-[#f5f0de]">
                    {saveError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-white/10 bg-black px-4 py-2.5 text-[#f5f0de] outline-none placeholder:text-white/30 focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/\s+/g, "") })}
                    className="w-full border border-white/10 bg-black px-4 py-2.5 text-[#f5f0de] outline-none placeholder:text-white/30 focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]"
                    placeholder="username"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-white/10 bg-black px-4 py-2.5 text-[#f5f0de] outline-none placeholder:text-white/30 focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]"
                    placeholder="name@example.com"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#f5f0de]">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, 500) })}
                    className="w-full resize-none border border-white/10 bg-black px-4 py-2.5 text-[#f5f0de] outline-none placeholder:text-white/30 focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]"
                    rows={4}
                    placeholder="Tell people a little about yourself"
                  />
                  <p className="mt-1 text-xs text-white/45">{formData.bio.length}/500</p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <Link
                    href={`/profile/${user.username}`}
                    className="border border-white/10 px-5 py-2.5 text-[#f5f0de] transition hover:bg-white/5"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 bg-[#ff7a1a] px-5 py-2.5 font-black text-black transition hover:bg-[#ff8d3b] disabled:opacity-60"
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
