"use client";

import { useEffect, useState } from "react";
import ErrorPopupCard from "@/components/ErrorPopupCard";
import { getErrorCode } from "@/lib/report-error";

type PopupState = {
  title: string;
  message: string;
  code?: number;
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
        title: "Facing some error",
        message: "Please try again.",
        code: getErrorCode({
          title: event.error instanceof Error ? event.error.name : event.message,
          message: event.message,
        }),
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setPopup({
        title: "Facing some error",
        message: "Please try again.",
        code: getErrorCode({
          message: formatReason(event.reason),
        }),
      });
    };

    const handleCustomError = (event: Event) => {
      const custom = event as CustomEvent<PopupState>;
      setPopup({
        title: custom.detail?.title || "Facing some error",
        message: custom.detail?.message || "Please try again.",
        code: custom.detail?.code || 500,
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
      code={popup.code}
      onClose={() => setPopup(null)}
      onRetry={() => window.location.reload()}
    />
  );
}
