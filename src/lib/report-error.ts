type ReportErrorInput = {
  title?: string;
  message: string;
  details?: string | null;
};

export function reportAppError(input: ReportErrorInput): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("cineparte:error", {
        detail: {
          title: input.title || "Something went wrong",
          message: input.message,
          details: input.details || null,
        },
      })
    );
  }

  console.error(input.title || "Something went wrong", input.message, input.details || "");
}
