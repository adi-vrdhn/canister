import { NextRequest, NextResponse } from "next/server";
import { getPublicListWithDetails } from "@/lib/lists-public";
import { normalizeListIdParam } from "@/lib/list-ids";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const list = await getPublicListWithDetails(normalizeListIdParam(id));

  if (!list) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, list });
}
