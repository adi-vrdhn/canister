"use client";

import Link from "next/link";
import ErrorPopupCard from "@/components/ErrorPopupCard";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#090909]">
        <ErrorPopupCard
          title="Application error"
          message={error.message || "The app hit an unrecoverable error."}
          details={error.digest ? `Digest: ${error.digest}` : error.stack || null}
          onRetry={reset}
          retryLabel="Try again"
          homeHref="/dashboard"
        />
        <div className="sr-only">
          <Link href="/dashboard">Go to dashboard</Link>
        </div>
      </body>
    </html>
  );
}
