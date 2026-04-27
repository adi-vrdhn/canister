"use client";

import { useState } from "react";
import { deleteUser, sendPasswordResetEmail } from "firebase/auth";
import { get, ref, remove } from "firebase/database";
import { KeyRound, LogOut, Trash2, LifeBuoy } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine } from "../settings-ui";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { deleteList } from "@/lib/lists";
import type { List, MovieLog } from "@/types";
import { useRouter } from "next/navigation";

export default function SettingsAccountPage() {
  const router = useRouter();
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");

  const resetPassword = async () => {
    if (!auth.currentUser?.email) {
      setError("No email address is attached to this account.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      setMessage("Password reset email sent.");
    } catch {
      setError("Could not send a password reset email.");
    } finally {
      setBusy(false);
    }
  };

  const deactivateAccount = async () => {
    if (!user) return;
    const confirmed = window.confirm("Deactivate your account? You can sign back in later.");
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setMessage(null);
    try {
      await updateSection("account", { status: "deactivated" });
      setMessage("Account deactivated.");
      await handleSignOut();
    } catch {
      setError("Could not deactivate the account.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!user || !auth.currentUser) return;
    const first = window.confirm("Delete your account and all related data?");
    if (!first) return;
    const second = window.confirm("This cannot be undone. Delete everything now?");
    if (!second) return;

    setBusy(true);
    setError("");
    setMessage(null);

    try {
      const [followsSnap, logsSnap, listsSnap, postsSnap, sharesSnap] = await Promise.all([
        get(ref(db, "follows")),
        get(ref(db, "movie_logs")),
        get(ref(db, "lists")),
        get(ref(db, "cine_posts")),
        get(ref(db, "shares")),
      ]);

      const tasks: Promise<void>[] = [];

      if (followsSnap.exists()) {
        Object.entries(followsSnap.val() as Record<string, any>).forEach(([id, follow]) => {
          if (follow.follower_id === user.id || follow.following_id === user.id) {
            tasks.push(remove(ref(db, `follows/${id}`)));
          }
        });
      }

      if (logsSnap.exists()) {
        Object.entries(logsSnap.val() as Record<string, MovieLog>).forEach(([id, log]) => {
          if (log.user_id === user.id) tasks.push(remove(ref(db, `movie_logs/${id}`)));
        });
      }

      if (listsSnap.exists()) {
        Object.entries(listsSnap.val() as Record<string, List>).forEach(([listId, list]) => {
          if (list.owner_id === user.id) tasks.push(deleteList(listId, user.id));
        });
      }

      if (postsSnap.exists()) {
        Object.entries(postsSnap.val() as Record<string, any>).forEach(([id, post]) => {
          if (post.user_id === user.id) tasks.push(remove(ref(db, `cine_posts/${id}`)));
        });
      }

      if (sharesSnap.exists()) {
        Object.entries(sharesSnap.val() as Record<string, any>).forEach(([id, share]) => {
          if (share.sender_id === user.id || share.receiver_id === user.id) tasks.push(remove(ref(db, `shares/${id}`)));
        });
      }

      tasks.push(remove(ref(db, `notifications/${user.id}`)));
      tasks.push(remove(ref(db, `users/${user.id}`)));

      await Promise.all(tasks);
      await deleteUser(auth.currentUser);
      await authSignOut();
      router.push("/auth/login");
    } catch {
      setError("Could not delete the account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Account"
      description="Password, deactivation and deletion. Kept plain and small."
    >
      <div className="space-y-2">
        <SettingLine icon={KeyRound} title="Change password" description="Send a reset email to the connected address.">
          <button onClick={resetPassword} disabled={busy} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            Reset email
          </button>
        </SettingLine>

        <SettingLine icon={LogOut} title="Deactivate account" description="Temporarily pause the account and sign out.">
          {settings.account.status === "deactivated" ? (
            <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">
              Deactivated
            </span>
          ) : (
            <button onClick={deactivateAccount} disabled={busy} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Deactivate
            </button>
          )}
        </SettingLine>

        <SettingLine icon={Trash2} title="Delete account" description="Remove the profile and related data permanently.">
          <button onClick={deleteAccount} disabled={busy} className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50">
            Delete forever
          </button>
        </SettingLine>

        <SettingLine icon={LifeBuoy} title="Help" description="If something feels off, contact support.">
          <a href="mailto:support@canisterr.com" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            Email support
          </a>
        </SettingLine>

        {message && <p className="pt-2 text-xs text-emerald-700">{message}</p>}
        {error && <p className="pt-2 text-xs text-rose-700">{error}</p>}
      </div>
    </SettingsPageFrame>
  );
}
