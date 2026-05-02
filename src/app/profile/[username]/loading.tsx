import RouteLoadingSkeleton from "@/components/RouteLoadingSkeleton";

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Loading profile"
      description="Fetching profile details and socials."
    />
  );
}
