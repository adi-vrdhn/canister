"use client";

import ErrorPopupCard from "@/components/ErrorPopupCard";
import { getErrorCode } from "@/lib/report-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPopupCard
      title="Facing some error"
      message="Please try again."
      code={getErrorCode({
        title: error.name,
        message: error.message,
      })}
      onRetry={reset}
      retryLabel="Reload page"
    />
  );
}
