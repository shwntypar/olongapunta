// Local knowledge about who picks up where — rules the timetable can't show.
// Read by the jeepney layer (application/martins/jeepneyLayer.ts) and the
// trip planner (application/martins/planMixedTrip.ts). Rider reports — confirm
// and adjust here.

/**
 * Long-haul routes. Leaving the city they fill up at their downtown terminal
 * and seldom stop on the way out, so that direction can only be boarded near
 * its start (PROVINCIAL_BOARD_WITHIN_KM in jeepneyLayer.ts). Coming into the
 * city they can be flagged as usual.
 */
export const PROVINCIAL_ROUTE_IDS = new Set([
  "route-2", // J-08 Blue — Mangan-Vaca, Subic
  "route-8", // J-06 Brown — Forestry, Old Cabalan
  "route-9", // J-06 Brown — Old Cabalan
  "route-10", // J-01 Brown — Tipo, Bataan
  "route-12", // J-10 White — Dinalupihan, Bataan
  "route-14", // J-09 Blue — Castillejos
  "route-15", // J-09 Blue — San Marcelino
]);

/** In an area (matched on the nearest locality's name), only these routes pick riders up. */
export interface LocalBoardingRule {
  localities: RegExp;
  onlyRoutes: string[];
  /** Shown in the steps when a rider boards there. */
  note: string;
}

export const LOCAL_BOARDING_RULES: LocalBoardingRule[] = [
  {
    // White (Dinalupihan) and Brown Tipo pass through Cabalan but usually come through full and don't stop.
    localities: /cabalan/i,
    onlyRoutes: ["route-8", "route-9"], // J-06 Brown — the Cabalan jeepney, boardable here in both directions
    note: "In Cabalan, take the J-06 — the White (Dinalupihan) and Brown Tipo jeepneys usually pass full and don't pick up here.",
  },
];

/**
 * Routes offered only when no other jeepney can make the trip (planMixedTrip.ts plans without them first).
 * `instead`: the routes riders take instead — documentation only.
 */
export interface FallbackRule {
  routes: string[];
  instead: string[];
}

export const FALLBACK_ROUTES: FallbackRule[] = [
  {
    routes: ["route-6", "route-7"], // J-05 Cream — Gordon Heights (Waterdam / Long Road): runs, but few units
    instead: ["route-3", "route-1"], // J-03 Red, J-01 Yellow — the common jeepneys on the same roads
  },
];
