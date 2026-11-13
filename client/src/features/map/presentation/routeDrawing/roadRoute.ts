// Driving, walking and motor routes from Mapbox Directions.

import mapboxgl from "mapbox-gl";
import type { DirectionsRoute, DirectionsStep, TravelMode } from "../../domain/types";
import { hideRouteLines, setWalkDotsVisible, showRouteLines, showWalkDots } from "../mapbox/activeRouteLayers";

const LINE_COLOR: Partial<Record<TravelMode, string>> = { driving: "#3b82f6", cycling: "#f59e0b" };
const MODE_LABEL: Partial<Record<TravelMode, string>> = { driving: "Drive", walking: "Walk", cycling: "Motor" };

/** Walking shows as dots (same style as walking legs elsewhere); driving and motor as a coloured line. */
export function showRoadRoute(map: mapboxgl.Map, route: DirectionsRoute, mode: TravelMode) {
  if (mode === "walking") {
    hideRouteLines(map);
    showWalkDots(map, [route.geometry]);
    return;
  }
  setWalkDotsVisible(map, false);
  showRouteLines(map, [{ geometry: route.geometry, color: LINE_COLOR[mode] ?? LINE_COLOR.driving! }]);
}

const formatDistance = (meters: number) => (meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`);

/** A summary line ("Drive — 2.9 km (approx. 11 min)") followed by Mapbox's turn-by-turn steps. */
export function roadRouteSteps(route: DirectionsRoute, mode: TravelMode): DirectionsStep[] {
  const label = MODE_LABEL[mode] ?? "Drive";
  const minutes = Math.round((route.duration ?? 0) / 60);
  const steps = route.legs?.[0]?.steps ?? [];

  return [
    { maneuver: { instruction: `${label} — ${formatDistance(route.distance)} (approx. ${minutes} min)` }, distance: 0 },
    ...steps.map((step) => ({ maneuver: { instruction: step.maneuver?.instruction || "Continue" }, distance: step.distance || 0 })),
  ];
}
