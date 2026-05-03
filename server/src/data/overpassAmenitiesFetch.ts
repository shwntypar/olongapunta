/**
 * Keep query + mirrors in sync with client/src/lib/overpass/amenityQuery.ts
 * and client/src/lib/overpass/fetchOverpassAmenities.ts
 */
const AMENITY_QUERY = `
[out:json][timeout:90];
(
  node["amenity"](14.80,120.25,14.85,120.30);
  way["amenity"](14.80,120.25,14.85,120.30);
  node["shop"](14.80,120.25,14.85,120.30);
  way["shop"](14.80,120.25,14.85,120.30);
);
out body;
>;
out skel qt;
`.trim();

const URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

const USER_AGENT =
  "Olongapunta/1.0 (map amenities; +https://www.openstreetmap.org/copyright)";

type Ok = { ok: true; data: unknown };
type Err = { ok: false; message: string; detail?: string; upstreamStatus: number };

function isRemarkError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.remark === "string" && o.remark.length > 0) {
    if (!Array.isArray(o.elements) || o.elements.length === 0) {
      return o.remark;
    }
  }
  return null;
}

export async function fetchOverpassAmenitiesJson(): Promise<Ok | Err> {
  let last: { status: number; snippet: string } = { status: 0, snippet: "" };

  for (const url of URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: AMENITY_QUERY,
        headers: {
          "Content-Type": "text/plain",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(120_000),
      });

      const text = await res.text();
      if (!res.ok) {
        last = { status: res.status, snippet: text.slice(0, 400) };
        continue;
      }

      let data: unknown;
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        return {
          ok: false,
          message: "Overpass returned non-JSON",
          detail: text.slice(0, 400),
          upstreamStatus: res.status,
        };
      }

      const remark = isRemarkError(data);
      if (remark) {
        last = { status: res.status, snippet: remark };
        continue;
      }

      return { ok: true, data };
    } catch (e) {
      last = {
        status: 0,
        snippet: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return {
    ok: false,
    message:
      last.status === 0
        ? "Could not reach any Overpass instance"
        : "All Overpass mirrors failed",
    detail: last.snippet,
    upstreamStatus: last.status,
  };
}
