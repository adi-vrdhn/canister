"use client";

import Link from "next/link";
import { ChevronRight, UserRoundCog, Upload, Shield, Bell, Users, KeyRound, LifeBuoy } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "./settings-shared";

const sections = [
  { href: "/profile/settings/profile", icon: UserRoundCog, title: "Profile", desc: "Photo, name, username and bio." },
  { href: "/profile/settings/import", icon: Upload, title: "Import", desc: "Letterboxd CSV and data export." },
  { href: "/profile/settings/privacy", icon: Shield, title: "Privacy", desc: "Profile, list and log visibility." },
  { href: "/profile/settings/notifications", icon: Bell, title: "Notifications", desc: "Follow, comment and email alerts." },
  { href: "/profile/settings/social", icon: Users, title: "Social", desc: "Blocked users and collaborations." },
  { href: "/profile/settings/account", icon: KeyRound, title: "Account", desc: "Password, deactivate and delete profile." },
  { href: "mailto:support@canisterr.com", icon: LifeBuoy, title: "Support", desc: "Help, bug reports and contact." },
];

export default function ProfileSettingsIndexPage() {
  const { user, loading, handleSignOut } = useSettingsUser();

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Settings"
      description="Pick a section. Each one opens on its own page so the controls stay small and easy to scan."
      backHref="/profile"
    >
      <div className="divide-y divide-white/10">
        {sections.map((section) =>
          section.href.startsWith("mailto:") ? (
            <a key={section.title} href={section.href} className="flex items-center gap-3 py-3 transition hover:translate-x-0.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#ff7a1a]">
                <section.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#ff7a1a]">{section.title}</span>
                <span className="block text-xs text-white/55">{section.desc}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-white/35" />
            </a>
          ) : (
            <Link key={section.href} href={section.href} className="flex items-center gap-3 py-3 transition hover:translate-x-0.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#ff7a1a]">
                <section.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#ff7a1a]">{section.title}</span>
                <span className="block text-xs text-white/55">{section.desc}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-white/35" />
            </Link>
          )
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="space-y-1">
        {[
          { href: "/terms", label: "Terms and Conditions" },
          { href: "/privacy", label: "Privacy Policy" },
          { href: "/credits", label: "Credits" },
          { href: "https://form.typeform.com/to/vqAd3KQM", label: "Feedback", external: true },
        ].map((link) => (
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/5 hover:text-[#ffb36b]"
              >
                <span>{link.label}</span>
                <ChevronRight className="h-4 w-4 text-white/35" />
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-[#f5f0de] transition hover:bg-white/5 hover:text-[#ffb36b]"
              >
                <span>{link.label}</span>
                <ChevronRight className="h-4 w-4 text-white/35" />
              </Link>
            )
          ))}
        </div>
      </div>
    </SettingsPageFrame>
  );
}
