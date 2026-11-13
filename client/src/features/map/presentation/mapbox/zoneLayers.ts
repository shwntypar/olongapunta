// TODA zone polygons: a tinted fill, a dashed outline and the zone code.

import mapboxgl from "mapbox-gl";
import type { TricycleZone } from "../../domain/TricycleZoneData";
import { formatZoneFare } from "../../domain/zoneFare";

const ids = (zoneId: string) => ({
  source: `tricycle-zone-source-${zoneId}`,
  fill: `tricycle-zone-fill-${zoneId}`,
  outline: `tricycle-zone-outline-${zoneId}`,
  label: `tricycle-zone-label-${zoneId}`,
});

/**
 * Draws one zone. Clicking inside it shows the zone's name and fare, unless
 * canShowPopup() says no (e.g. the click is setting the trip's start point).
 */
export function drawZone(map: mapboxgl.Map, zone: TricycleZone, visible: boolean, canShowPopup: () => boolean = () => true) {
  const id = ids(zone.id);
  const data = { type: "Feature" as const, properties: {}, geometry: zone.polygon };

  const existing = map.getSource(id.source) as mapboxgl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    return;
  }

  const visibility = visible ? "visible" : "none";
  map.addSource(id.source, { type: "geojson", data });
  map.addLayer({ id: id.fill, type: "fill", source: id.source, layout: { visibility }, paint: { "fill-color": zone.color, "fill-opacity": 0.15 } });
  map.addLayer({
    id: id.outline,
    type: "line",
    source: id.source,
    layout: { visibility, "line-join": "round" },
    paint: { "line-color": zone.color, "line-width": 2.5, "line-dasharray": [2, 1.5] },
  });
  map.addLayer({
    id: id.label,
    type: "symbol",
    source: id.source,
    layout: {
      visibility,
      "text-field": zone.code,
      "text-size": 13,
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "symbol-placement": "point",
    },
    paint: { "text-color": zone.color, "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
  });

  map.on("mouseenter", id.fill, () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", id.fill, () => (map.getCanvas().style.cursor = ""));
  map.on("click", id.fill, (e) => {
    if (!canShowPopup()) return;
    e.originalEvent?.stopPropagation();
    const popup = document.createElement("div");
    const title = document.createElement("div");
    title.style.cssText = "font-weight:800;font-size:12px;";
    title.textContent = `${zone.code} — ${zone.name}`;
    const fare = document.createElement("div");
    fare.style.cssText = "font-size:11px;color:#475569;";
    fare.textContent = formatZoneFare(zone);
    popup.append(title, fare);
    new mapboxgl.Popup({ offset: 10, closeButton: false }).setLngLat(e.lngLat).setDOMContent(popup).addTo(map);
  });
}

/** Shows the zones in visibleZoneIds and hides the rest. */
export function showZones(map: mapboxgl.Map, zones: TricycleZone[], visibleZoneIds: string[]) {
  for (const zone of zones) {
    const visibility = visibleZoneIds.includes(zone.id) ? "visible" : "none";
    for (const layer of [ids(zone.id).fill, ids(zone.id).outline, ids(zone.id).label]) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visibility);
    }
  }
}
