import { tricycleZones } from "../../domain/TricycleZoneData";
import { ZoneRules } from "./types";

// =====================================================
// 🛺 GREEN ZONE (toda-2) REAL BOARDING SPOTS
// =====================================================
// Field-reported points: "typically the tricycles are waiting here."
// This is real data, not a guess — several of these sit on plain side
// streets, not through roads, which the old boardOnMainRoadOnly heuristic
// would have wrongly excluded. Kept here as the original [lon, lat] pairs
// (not just node ids) so they can be re-snapped if graph.json is ever
// rebuilt with different OSM node ids.
export const GREEN_ZONE_BOARDING_SPOTS: [number, number][] = [
  [120.288369, 14.841927],
  [120.289132, 14.841154],
  [120.2879, 14.840159],
  [120.28693, 14.839414],
  [120.284696, 14.838305],
  [120.285113, 14.837892],
  [120.286951, 14.83606],
  [120.283862, 14.836362],
  [120.281573, 14.834468],
  [120.282751, 14.831669],
  [120.281357, 14.830094],
  [120.280885, 14.832004],
  [120.283797, 14.826425],
  [120.283378, 14.827119],
  [120.290276, 14.830286],
  [120.287535, 14.829865],
  [120.281966, 14.828942],
  [120.287884, 14.82721],
  [120.287398, 14.833966],
];

// Nearest-graph-node id for each coordinate above (martins/graph.json,
// current build) — see GREEN_ZONE_BOARDING_SPOTS for the source coords.
const GREEN_ZONE_TERMINAL_NODE_IDS = [
  "1178571753",
  "1178571754",
  "2100773785",
  "3057277814",
  "1178571587",
  "8395678656",
  "1178571426",
  "10872386236",
  "1611283366",
  "1993771250",
  "535111610",
  "1297310266",
  "7686943343",
  "1611283156",
  "2083110915",
  "1611283254",
  "343395512",
  "1611283164",
  "2060105871",
];

// =====================================================
// ⚠️ PARTIALLY PLACEHOLDER DATA — not yet surveyed
// =====================================================
// The thesis handoff doc lists "collect TODA zone polygons, terminals,
// fares, and crossing agreements (survey/interviews)" as an open item.
// crossTo below is derived from actual geometry (every zone pair here is
// within 0.4km of each other's boundary — the same adjacency threshold
// getTricycleRoute.ts already used), not guessed. crossFee and
// mainRoadAllowed are still placeholders — replace with real surveyed
// figures once you have them. baseFare/farePerKm are NOT duplicated here —
// see getZoneFare() below, which reads them from TricycleZoneData.ts, the
// single source of truth for actual zone fare data.
export const ZONE_RULES: ZoneRules = {
  "toda-1": {
    crossTo: ["toda-2", "toda-3"], // ZONE-1 is adjacent to both (~0.04km, ~0.07km gaps)
    crossFee: 20, // PLACEHOLDER — matches the ₱20 figure from the thesis doc's example config
    mainRoadAllowed: true, // PLACEHOLDER — assume allowed-but-penalized until a zone is confirmed to ban it
    terminals: [], // PLACEHOLDER — no surveyed terminal node ids yet
    // No mainRoadPenalty override — keeps the default soft avoidance.
    boardOnMainRoadOnly: true, // trikes wait along the main road, not every side street
  },
  "toda-2": {
    crossTo: ["toda-1", "toda-3"], // ZONE-2 is adjacent to both (~0.04km, ~0.04km gaps)
    crossFee: 20,
    mainRoadAllowed: true,
    // Real field-reported waiting spots — see GREEN_ZONE_BOARDING_SPOTS
    // above. boardOnlyAtTerminals means boarding is restricted to exactly
    // these, replacing the road-class guess (boardOnMainRoadOnly) now that
    // real data exists for this zone.
    terminals: GREEN_ZONE_TERMINAL_NODE_IDS,
    boardOnlyAtTerminals: true,
    mainRoadPenalty: 1, // Green — main roads treated as a normal route, not avoided
  },
  "toda-3": {
    crossTo: ["toda-1", "toda-2"], // ZONE-3 is adjacent to both (~0.07km, ~0.04km gaps)
    // PLACEHOLDER, deliberately > baseFare (₱30) — Blue charges a steep
    // premium for letting a rider continue into another TODA's turf on the
    // same ride, instead of the flat ₱20 every other zone uses. This is
    // what makes "alight, walk, board fresh in the next zone" genuinely
    // cheaper than riding straight through for some trips — replace with
    // whatever Blue's real crossing surcharge turns out to be.
    crossFee: 35,
    mainRoadAllowed: true,
    terminals: [],
    mainRoadPenalty: 1, // Blue — main roads treated as a normal route, not avoided
    boardOnMainRoadOnly: true,
  },
};

/** Falls back to a permissive default for any zone id missing from ZONE_RULES. */
export const DEFAULT_ZONE_RULE = {
  crossTo: [] as string[],
  crossFee: 20,
  mainRoadAllowed: true,
};

export function getZoneRule(zoneId: string) {
  return ZONE_RULES[zoneId] ?? DEFAULT_ZONE_RULE;
}

const DEFAULT_FARE = { baseFare: 30, farePerKm: 8, includedKm: 2 };

/** Real fare data for a zone, read straight from TricycleZoneData.ts. */
export function getZoneFare(zoneId: string): { baseFare: number; farePerKm: number; includedKm: number } {
  const zone = tricycleZones.find((z) => z.id === zoneId);
  return zone ? { baseFare: zone.baseFare, farePerKm: zone.farePerKm, includedKm: zone.includedKm } : DEFAULT_FARE;
}
