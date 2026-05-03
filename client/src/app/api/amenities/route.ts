import { NextResponse } from "next/server";
import { fetchOverpassAmenitiesJson } from "@/lib/overpass/fetchOverpassAmenities";

/**
 * Same-origin proxy to Overpass (browser cannot reliably POST to Overpass due to CORS).
 * GET /api/amenities
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchOverpassAmenitiesJson();

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
