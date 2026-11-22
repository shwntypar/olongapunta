// Every call to the Mapbox Directions API lives here.

import { MAPBOX_TOKEN } from "../config";
import type { DirectionsRoute, LineGeometry, TravelMode } from "../domain/types";

const DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox";

type RoadMode = Extract<TravelMode, "driving" | "walking" | "cycling">;

/**
 * Driving / walking / motor routes between two points, best first, with
 * Mapbox's alternatives. Motor ("cycling") uses the driving profile.
 */
export async function fetchRoadRoutes(mode: RoadMode, start: number[], end: number[]): Promise<DirectionsRoute[]> {
  const profile = mode === "cycling" ? "driving" : mode;
  const url = `${DIRECTIONS_URL}/${profile}/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&steps=true&alternatives=true&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json();
  return data.routes ?? [];
}

/**
 * Snaps a hand-digitized jeepney path onto real roads. Returns the
 * road-following line, or null when Mapbox cannot route it (the caller then
 * falls back to the raw digitized path).
 */
export async function fetchSnappedJeepneyPath(path: number[][], label?: string): Promise<LineGeometry | null> {
  if (!path || path.length < 2) return null;
  const tag = label ? `[${label}] ` : "";

  try {
    const coordinateString = path.map((coord) => `${coord[0]},${coord[1]}`).join(";");

    // continue_straight=false lets Mapbox double back at a waypoint — jeepney paths
    // routinely loop/U-turn at terminals, and forcing straight-through travel there
    // makes Mapbox reject the whole request, silently falling back to the raw
    // hand-drawn (road-cutting) coordinates for that route.
    const url = `${DIRECTIONS_URL}/driving/${coordinateString}?alternatives=false&continue_straight=false&geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`${tag}Mapbox request failed (HTTP ${response.status}). Falling back to straight lines.`);
      return null;
    }

    const data = await response.json();
    if (data.code !== "Ok") {
      console.warn(`${tag}Mapbox could not snap this path (code: ${data.code}). Falling back to straight lines.`, data.message);
      return null;
    }

    return data.routes?.[0]?.geometry ?? null;
  } catch (error) {
    console.error(`${tag}Error fetching exact jeepney path:`, error);
    return null;
  }
}
