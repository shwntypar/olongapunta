import mapboxgl from "mapbox-gl";
import { showRouteLines, showWalkDots } from "../mapbox/activeRouteLayers";
import { addPill } from "../mapbox/routeMarkers";
import { mapViewPadding } from "../mobile/sheetLayout";
import type { RouteDrawing } from "./types";

/** Draws a jeepney or tricycle itinerary, fits the view to it, and returns the pill markers it added. */
export function paintRouteDrawing(map: mapboxgl.Map, drawing: RouteDrawing): mapboxgl.Marker[] {
  showWalkDots(map, drawing.walks);
  showRouteLines(map, drawing.lines);
  const pills = drawing.pills.map((pill) => addPill(map, pill));

  const bounds = new mapboxgl.LngLatBounds();
  for (const geometry of [...drawing.walks, ...drawing.lines.map((line) => line.geometry)]) {
    for (const coord of geometry?.coordinates ?? []) bounds.extend(coord as [number, number]);
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: mapViewPadding(80, "half"), duration: 1200 });

  return pills;
}
