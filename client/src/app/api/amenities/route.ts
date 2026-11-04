import { NextResponse } from "next/server";
import { fetchOverpassAmenitiesJson } from "@/lib/overpass/fetchOverpassAmenities";

/**
 * Same-origin proxy to Overpass (browser cannot reliably POST to Overpass due to CORS).
 * GET /api/amenities
 *
 * AMENITY_OVERPASS_QUERY is a fixed string (same bboxes every time, no
 * per-request params), so the result is safe to cache for a while — amenity
 * data doesn't meaningfully change minute to minute, but the live Overpass
 * mirrors regularly take 30+ seconds (occasionally failing outright), which
 * every uncached page load was paying in full.
 */
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cache: { data: unknown; expiresAt: number } | null = null;
// Coalesces concurrent cache-miss requests (several tabs/users loading at
// once on a cold cache) onto a single in-flight Overpass call instead of
// each one independently waiting on, and hammering, the upstream mirrors.
let inFlight: ReturnType<typeof fetchOverpassAmenitiesJson> | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return NextResponse.json(cache.data, {
      headers: {
        "X-Amenities-Cache": "hit",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  }

  if (!inFlight) {
    inFlight = fetchOverpassAmenitiesJson().finally(() => {
      inFlight = null;
    });
  }

  const result = await inFlight;

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

  cache = { data: result.data, expiresAt: now + CACHE_TTL_MS };

  return NextResponse.json(result.data, {
    headers: {
      "X-Amenities-Cache": "miss",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
