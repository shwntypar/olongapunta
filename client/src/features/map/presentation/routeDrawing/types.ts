import type { DirectionsStep, LineGeometry } from "../../domain/types";
import type { RouteLine } from "../mapbox/activeRouteLayers";
import type { PillSpec } from "../mapbox/routeMarkers";

/**
 * Everything needed to show one itinerary: ride lines, walking legs, the
 * labelled pills along it, and the step-by-step list for the sidebar.
 * Builders produce this; paintRouteDrawing puts it on the map.
 */
export interface RouteDrawing {
  lines: RouteLine[];
  walks: LineGeometry[];
  pills: PillSpec[];
  steps: DirectionsStep[];
}
