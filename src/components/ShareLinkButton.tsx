"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Check, Share2 } from "lucide-react";

type ShareStatus = "idle" | "shared" | "copied";

interface ShareLinkButtonProps {
  href: string;
  title: string;
  text?: string;
  className?: string;
  showLabel?: boolean;
  ariaLabel?: string;
  onActivate?: () => void;
}

export default function ShareLinkButton({
  href,
  title,
  text,
  className = "",
  showLabel = false,
  ariaLabel,
  onActivate,
}: ShareLinkButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const flashStatus = (nextStatus: Exclude<ShareStatus, "idle">) => {
    setStatus(nextStatus);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setStatus("idle");
      timerRef.current = null;
    }, 1600);
  };

  const handleShare = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate?.();

    if (typeof window === "undefined") return;

    const absoluteUrl = new URL(href, window.location.origin).toString();
    const payload = {
      title,
      text: text || title,
      url: absoluteUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        flashStatus("shared");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        flashStatus("copied");
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(absoluteUrl);
          flashStatus("copied");
          return;
        }
      } catch (clipboardError) {
        console.error("Share link fallback failed:", clipboardError);
      }
    }

    window.prompt("Copy this link", absoluteUrl);
    flashStatus("copied");
  };

  const icon = status === "idle" ? <Share2 className="h-4 w-4" /> : <Check className="h-4 w-4" />;
  const label = status === "shared" ? "Shared" : status === "copied" ? "Copied" : "Share";

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center justify-center gap-2 transition ${className}`}
      aria-label={ariaLabel || `${label} link`}
      title={label}
    >
      {icon}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
