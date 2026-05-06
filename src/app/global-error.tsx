"use client";

import Link from "next/link";
import ErrorPopupCard from "@/components/ErrorPopupCard";
import { getErrorCode } from "@/lib/report-error";

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
          title="Facing some error"
          message="Please try again."
          code={getErrorCode({
            title: error.name,
            message: error.message,
          })}
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
