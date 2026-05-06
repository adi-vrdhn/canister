type ReportErrorInput = {
  title?: string;
  message: string;
  details?: string | null;
};

export function getErrorCode(input: Pick<ReportErrorInput, "title" | "message" | "details"> | unknown): number {
  const text =
    input && typeof input === "object"
      ? [
          "title" in input ? (input.title as string | undefined) : undefined,
          "message" in input ? (input.message as string | undefined) : undefined,
          "details" in input ? (input.details as string | null | undefined) : undefined,
        ]
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .join(" ")
          .toLowerCase()
      : "";

  if (
    text.includes("permission denied") ||
    text.includes("unauthorized") ||
    text.includes("not allowed") ||
    text.includes("auth")
  ) {
    return 403;
  }

  if (text.includes("not found") || text.includes("missing")) {
    return 404;
  }

  if (
    text.includes("invalid") ||
    text.includes("validation") ||
    text.includes("required") ||
    text.includes("already exists") ||
    text.includes("already there") ||
    text.includes("bad request")
  ) {
    return 400;
  }

  if (text.includes("timeout") || text.includes("network") || text.includes("offline") || text.includes("fetch")) {
    return 503;
  }

  return 500;
}

export function reportAppError(input: ReportErrorInput): void {
  const code = getErrorCode(input);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("cineparte:error", {
        detail: {
          title: "Facing some error",
          message: "Please try again.",
          code,
        },
      })
    );
  }

  console.error(input.title || "Something went wrong", input.message, input.details || "");
}
