// The other markers: the user's position, the destination, the labelled
// "Board here / Get down here" pills along a route, and Start/End pins on a
// single jeepney route.

import mapboxgl from "mapbox-gl";

/** The blue "you are here" marker (also moved to dropped pins and GPS fixes). */
export function addUserMarker(map: mapboxgl.Map, coords: [number, number]): mapboxgl.Marker {
  const el = document.createElement("div");
  el.style.cssText =
    "width:34px;height:34px;background:#3b82f6;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(0,0,0,0.3);cursor:pointer;";
  el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  return new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);
}

/** The magenta dot on the chosen destination. */
export function addDestinationMarker(map: mapboxgl.Map, coords: [number, number]): mapboxgl.Marker {
  const el = document.createElement("div");
  el.style.cssText = "width:24px;height:24px;background-color:#FF00FF;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.6);";
  return new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);
}

/** Colour schemes for route pills. */
export const PILL = {
  board: { border: "#3b82f6", text: "#1e3a8a" },
  boardNext: { border: "#16a34a", text: "#16a34a" },
  getDown: { border: "#dc2626", text: "#dc2626" },
  arrive: { border: "#db2777", text: "#db2777" },
  tricycle: { border: "#8b5cf6", text: "#8b5cf6" },
} as const;

export interface PillSpec {
  coords: number[];
  text: string;
  style: { border: string; text: string };
}

/** A labelled pill sitting just above a point on the route (e.g. "🚐 Board J-02 (Walk 380m)"). */
export function addPill(map: mapboxgl.Map, pill: PillSpec): mapboxgl.Marker {
  const el = document.createElement("div");
  const label = document.createElement("div");
  label.style.cssText = `background:white;border:3px solid ${pill.style.border};color:${pill.style.text};padding:5px 12px;border-radius:16px;font-weight:800;font-size:11px;box-shadow:0 4px 10px rgba(0,0,0,0.35);white-space:nowrap;`;
  label.textContent = pill.text;
  el.appendChild(label);
  return new mapboxgl.Marker({ element: el, anchor: "bottom", offset: [0, -10] }).setLngLat(pill.coords as [number, number]).addTo(map);
}

function endpointPin(map: mapboxgl.Map, coords: number[], text: string, borderColor: string): mapboxgl.Marker {
  const el = document.createElement("div");
  const label = document.createElement("div");
  label.style.cssText = `background-color:white;border:3px solid ${borderColor};color:#111827;padding:4px 8px;border-radius:12px;font-weight:bold;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3);`;
  label.textContent = text;
  el.appendChild(label);
  return new mapboxgl.Marker({ element: el }).setLngLat(coords as [number, number]).addTo(map);
}

/** "📍 Start" and "🏁 End" pins at the two ends of a jeepney route direction. */
export function addRouteEndpointPins(map: mapboxgl.Map, path: number[][], routeColor: string): mapboxgl.Marker[] {
  return [endpointPin(map, path[0], "📍 Start", routeColor), endpointPin(map, path[path.length - 1], "🏁 End", "#374151")];
}

export function removeMarkers(markers: mapboxgl.Marker[]) {
  for (const marker of markers) marker.remove();
}
