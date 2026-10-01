import { ZoneRules } from "./types";

// =====================================================
// ⚠️ PLACEHOLDER DATA — not yet surveyed
// =====================================================
// The thesis handoff doc lists "collect TODA zone polygons, terminals,
// fares, and crossing agreements (survey/interviews)" as an open item.
// Only one zone (toda-1, Barretto) exists in TricycleZoneData.ts today, and
// it has no real crossTo/terminal data. The values below let the algorithm
// and UI be built and exercised end-to-end now — replace every field here
// with real surveyed values before relying on this for anything but testing.
//
// crossTo is deliberately empty (no other real zones exist yet to cross
// into); add entries here once more zones are drawn and their crossing
// agreements are confirmed.
export const ZONE_RULES: ZoneRules = {
  "toda-1": {
    crossTo: [], // PLACEHOLDER — no surveyed crossing agreements yet
    crossFee: 20, // PLACEHOLDER — matches the ₱20 figure from the thesis doc's example config
    mainRoadAllowed: true, // PLACEHOLDER — assume allowed-but-penalized until a zone is confirmed to ban it
    baseFare: 30, // kept consistent with TricycleZoneData.ts's existing baseFare for this zone
    terminals: [], // PLACEHOLDER — no surveyed terminal node ids yet
  },
};

/** Falls back to a permissive default for any zone id missing from ZONE_RULES. */
export const DEFAULT_ZONE_RULE = {
  crossTo: [] as string[],
  crossFee: 20,
  mainRoadAllowed: true,
  baseFare: 30,
};

export function getZoneRule(zoneId: string) {
  return ZONE_RULES[zoneId] ?? DEFAULT_ZONE_RULE;
}
