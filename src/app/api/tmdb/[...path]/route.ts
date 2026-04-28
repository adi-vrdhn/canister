import { type NextRequest } from "next/server";
import { fetchTmdb } from "@/lib/tmdb-transport";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathname = Array.isArray(path) ? path.join("/") : path;
  const response = await fetchTmdb(pathname, Object.fromEntries(request.nextUrl.searchParams.entries()));
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "application/json";

  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}
