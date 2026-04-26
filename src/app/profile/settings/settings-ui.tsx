"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SettingLine({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#ff7a1a]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#ff7a1a]">{title}</p>
          <p className="text-xs leading-snug text-white/55">{description}</p>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function CompactToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        checked ? "border-[#ff7a1a] bg-[#ff7a1a] text-[#0a0a0a]" : "border-white/10 bg-white/5 text-[#f5f0de]"
      }`}
    >
      {label}
    </button>
  );
}

export function SmallPillButton({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? "border-[#ff7a1a] bg-[#ff7a1a] text-[#0a0a0a]" : "border-white/10 bg-white/5 text-[#f5f0de]"
      }`}
    >
      {children}
    </button>
  );
}
