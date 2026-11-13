// Markers for places (amenities, tricycle stands, jeepney stops): the round
// coloured icons, their click popups, and which ones show at each zoom.

import mapboxgl from "mapbox-gl";
import type { Place } from "../../domain/types";
import { categoryColor, categoryIconPath } from "../placeCategories";

/** Popups render this empty div; map.tsx portals the React popup (AmenityPopupBox) into it. */
export const POPUP_PORTAL_ID = "popup-portal-root";

/** 1 = shown from the city-wide zoom, 2 = from street zoom, 3/4 = only when zoomed right in. */
const PRIORITY: Record<string, number> = {
  townhall: 1, hospital: 1, police: 1, fire_station: 1, bus_station: 1, ferry_terminal: 1, university: 1, college: 1,
  school: 2, clinic: 2, dentist: 2, doctors: 2, pharmacy: 2, bank: 2, atm: 2, supermarket: 2, mall: 2, marketplace: 2,
  place_of_worship: 2, post_office: 2, fuel: 2, gas: 2, tricycle_stand: 2, jeepney_stop: 2,
  waste_basket: 4, toilets: 4, parking_space: 4, motorcycle_parking: 4, bicycle_parking: 4, shelter: 4, compressed_air: 4,
};
const priorityOf = (type: string) => PRIORITY[type.toLowerCase()] || 3;

function createMarkerElement(type: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "custom-marker";
  el.style.cssText = `width:24px;height:24px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.3);background-color:${categoryColor(type)};`;
  el.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="${categoryIconPath(type)}"></path>
    </svg>`;
  el.dataset.priority = String(priorityOf(type));
  el.dataset.type = type;
  return el;
}

/** Adds a clickable place marker. Clicking it opens an (empty) popup and calls onSelect, which fills it. */
export function addPlaceMarker(map: mapboxgl.Map, place: Place, onSelect: (place: Place) => void): mapboxgl.Marker {
  const el = createMarkerElement(place.type);
  const marker = new mapboxgl.Marker({ element: el }).setLngLat([place.lon, place.lat]).addTo(map);

  el.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllPopups();
    new mapboxgl.Popup({ offset: 25, closeButton: false })
      .setLngLat([place.lon, place.lat])
      .setHTML(`<div id="${POPUP_PORTAL_ID}"></div>`)
      .addTo(map);
    onSelect(place);
  });

  return marker;
}

function closeAllPopups() {
  const open = document.getElementsByClassName("mapboxgl-popup");
  while (open[0]) open[0].remove();
}

const SHOW_PRIORITY_1_FROM_ZOOM = 14.0;
const SHOW_PRIORITY_2_FROM_ZOOM = 16.5;
const SHOW_EVERYTHING_FROM_ZOOM = 17.5;

/**
 * Hides lower-priority markers when zoomed out. Tricycle stands and jeepney
 * stops are the app's subject matter, not clutter, so they show at any zoom.
 */
export function updatePlaceMarkerVisibility(markers: mapboxgl.Marker[], zoom: number) {
  for (const marker of markers) {
    const el = marker.getElement();
    const type = el.dataset.type;
    const priority = parseInt(el.dataset.priority || "3");

    let visible: boolean;
    if (type === "tricycle_stand" || type === "jeepney_stop") visible = true;
    else if (zoom < SHOW_PRIORITY_1_FROM_ZOOM) visible = false;
    else if (priority > 1 && zoom < SHOW_PRIORITY_2_FROM_ZOOM) visible = false;
    else if (priority > 2 && zoom < SHOW_EVERYTHING_FROM_ZOOM) visible = false;
    else visible = true;

    el.style.display = visible ? "flex" : "none";
  }
}
