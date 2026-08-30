import { NextResponse } from "next/server";
import { fetchOverpassRoadsJson } from "@/lib/overpass/fetchOverpassRoads";

/**
 * Same-origin proxy to Overpass for in-zone road data (browser cannot
 * reliably POST to Overpass due to CORS).
 * GET /api/tricycle-roads?minLon=&minLat=&maxLon=&maxLat=
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minLon = parseFloat(searchParams.get("minLon") || "");
  const minLat = parseFloat(searchParams.get("minLat") || "");
  const maxLon = parseFloat(searchParams.get("maxLon") || "");
  const maxLat = parseFloat(searchParams.get("maxLat") || "");

  if ([minLon, minLat, maxLon, maxLat].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "minLon, minLat, maxLon, maxLat are required" }, { status: 400 });
  }

  const result = await fetchOverpassRoadsJson([minLon, minLat, maxLon, maxLat]);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message,
        upstreamStatus: result.upstreamStatus,
        detail: result.detail,
      },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json(result.data);
}
