"use client";

import { useEffect, useState } from "react";
import ErrorPopupCard from "@/components/ErrorPopupCard";

type PopupState = {
  title: string;
  message: string;
  details?: string | null;
};

function formatReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message || "Unexpected error";
  if (typeof reason === "string") return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return "Unexpected error";
  }
}

export default function GlobalErrorListener() {
  const [popup, setPopup] = useState<PopupState | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setPopup({
        title: "Something went wrong",
        message: event.message || "An unexpected error occurred.",
        details: event.error instanceof Error ? event.error.stack || event.error.message : null,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setPopup({
        title: "Something went wrong",
        message: formatReason(event.reason) || "An unexpected error occurred.",
      });
    };

    const handleCustomError = (event: Event) => {
      const custom = event as CustomEvent<PopupState>;
      setPopup({
        title: custom.detail?.title || "Something went wrong",
        message: custom.detail?.message || "An unexpected error occurred.",
        details: custom.detail?.details || null,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("cineparte:error", handleCustomError as EventListener);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("cineparte:error", handleCustomError as EventListener);
    };
  }, []);

  if (!popup) return null;

  return (
    <ErrorPopupCard
      title={popup.title}
      message={popup.message}
      details={popup.details}
      onClose={() => setPopup(null)}
      onRetry={() => window.location.reload()}
    />
  );
}
