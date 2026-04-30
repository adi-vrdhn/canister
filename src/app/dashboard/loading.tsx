import RouteLoadingSkeleton from "@/components/RouteLoadingSkeleton";

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Loading your home"
      description="Fetching your feed, friends activity, and discovery rails."
    />
  );
}

