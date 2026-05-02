import RouteLoadingSkeleton from "@/components/RouteLoadingSkeleton";

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Loading taste"
      description="Fetching your taste profile and suggestions."
    />
  );
}
