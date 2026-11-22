// The line each jeepney route direction follows. Routes were digitized by
// hand with only a few points each (MockData.ts: 4–18 per route), which cuts
// straight across hills and rivers; scripts/snap-routes.ts snaps every
// direction onto real roads once and saves it to snappedRoutes.json. Every
// part of the app — matcher, Mixed graph, map layers, drawings — reads
// routes through routePath(), so they all use the same road-following line.

import type { JeepneyRoute } from "./MockData";
import snapped from "./snappedRoutes.json";

export type RouteDirectionKey = "fwd" | "rev";

type Path = [number, number][];
const SNAPPED = (snapped as unknown as { routes: Record<string, Partial<Record<RouteDirectionKey, Path>>> }).routes;

/** The hand-digitized points for one direction (the return falls back to the forward path reversed). */
export function digitizedPath(route: JeepneyRoute, direction: RouteDirectionKey): Path | null {
  if (!route.path || route.path.length < 2) return null;
  if (direction === "fwd") return route.path;
  return route.returnPath && route.returnPath.length >= 2 ? route.returnPath : [...route.path].reverse();
}

/** The road-snapped line for one direction, or the digitized one if it hasn't been snapped. */
export function routePath(route: JeepneyRoute, direction: RouteDirectionKey): Path | null {
  return SNAPPED[route.id]?.[direction] ?? digitizedPath(route, direction);
}

/** True if this direction has a saved road-snapped line. */
export const isSnapped = (route: JeepneyRoute, direction: RouteDirectionKey) => !!SNAPPED[route.id]?.[direction];
