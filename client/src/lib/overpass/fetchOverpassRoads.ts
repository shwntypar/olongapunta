import { OVERPASS_INTERPRETER_URLS, OVERPASS_USER_AGENT } from "./amenityQuery";
import { buildRoadOverpassQuery } from "./roadQuery";

export type OverpassResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      httpStatus: number;
      upstreamStatus: number;
      message: string;
      detail?: string;
    };

function isOverpassRemarkError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.remark === "string" && o.remark.length > 0) {
    if (!Array.isArray(o.elements) || o.elements.length === 0) {
      return o.remark;
    }
  }
  return null;
}

/**
 * POST to Overpass mirrors until one succeeds — same failover pattern as
 * fetchOverpassAmenitiesJson, parameterized by bbox instead of a fixed query.
 */
export async function fetchOverpassRoadsJson(
  bbox: [minLon: number, minLat: number, maxLon: number, maxLat: number]
): Promise<OverpassResult> {
  const query = buildRoadOverpassQuery(bbox);
  let lastFail: { status: number; snippet: string } = { status: 0, snippet: "" };

  for (const url of OVERPASS_INTERPRETER_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: query,
        headers: {
          "Content-Type": "text/plain",
          Accept: "application/json",
          "User-Agent": OVERPASS_USER_AGENT,
        },
        signal: AbortSignal.timeout(120_000),
      });

      const text = await res.text();

      if (!res.ok) {
        lastFail = { status: res.status, snippet: text.slice(0, 400) };
        continue;
      }

      let data: unknown;
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        return {
          ok: false,
          httpStatus: 502,
          upstreamStatus: res.status,
          message: "Overpass returned non-JSON body",
          detail: text.slice(0, 400),
        };
      }

      const remarkErr = isOverpassRemarkError(data);
      if (remarkErr) {
        lastFail = { status: res.status, snippet: remarkErr };
        continue;
      }

      return { ok: true, data };
    } catch (e) {
      lastFail = { status: 0, snippet: e instanceof Error ? e.message : String(e) };
    }
  }

  return {
    ok: false,
    httpStatus: 502,
    upstreamStatus: lastFail.status,
    message:
      lastFail.status === 0
        ? "Could not reach any Overpass instance (network or timeout)"
        : "All Overpass mirrors failed for this query",
    detail: lastFail.snippet || undefined,
  };
}
