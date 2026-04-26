"use client";

import ErrorPopupCard from "@/components/ErrorPopupCard";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPopupCard
      title="Page crashed"
      message={error.message || "An unexpected error occurred while loading this page."}
      details={error.digest ? `Digest: ${error.digest}` : error.stack || null}
      onRetry={reset}
      retryLabel="Reload page"
    />
  );
}
