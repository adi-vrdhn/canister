import RouteLoadingSkeleton from "@/components/RouteLoadingSkeleton";

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Loading friends"
      description="Fetching recent friend activity and poster stacks."
    />
  );
}
