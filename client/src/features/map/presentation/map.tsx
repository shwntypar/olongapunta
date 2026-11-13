"use client";

// =====================================================
// 🗺️ MAP PAGE
// =====================================================
// Holds the page's state (destination, origin, travel mode, route results)
// and wires the sidebar, map and floating controls together. The pieces it
// delegates to:
//
//   mapbox/          everything drawn on the map (markers, route lines, zones)
//   routeDrawing/    what to draw for an itinerary in each travel mode
//   components/      floating controls (search, layers, banners)
//   ../application/  routing: Mapbox Directions, jeepney matcher, Martins (tricycle)
//   ../domain/       data: routes, zones, places, shared types

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { findTransitRouteCandidates } from "../application/jeepney/transitCandidates";
import { fetchRoadRoutes } from "../application/mapboxDirections";
import { NO_TRICYCLE_PLAN, planTricycleTrip, type TricycleTripPlan } from "../application/martins/planTricycleTrip";
import { DEFAULT_CITY_CENTER, DEFAULT_ZOOM, MAP_STYLE, MAPBOX_TOKEN, SHOW_JEEPNEY_STOPS } from "../config";
import { JEEPNEY_LINE_COLORS } from "../domain/jeepneyColors";
import { mockRoutes, type JeepneyColor } from "../domain/MockData";
import { JEEPNEY_STOP_PLACES, matchesSearch, parseAmenities, TRICYCLE_STAND_PLACES } from "../domain/places";
import { tricycleZones } from "../domain/TricycleZoneData";
import type { DirectionsRoute, DirectionsStep, Origin, Place, TransitCandidate, TravelMode } from "../domain/types";
import { isMobileDevice } from "../utils/device";
import { getCurrentCoords, reverseGeocode } from "../utils/geolocation";

import AmenityPopupBox from "./AmenityPopupBox";
import LayersPanel from "./components/LayersPanel";
import MapBanner from "./components/MapBanner";
import SearchBox from "./components/SearchBox";
import { hideActiveRoute, setWalkDotsVisible } from "./mapbox/activeRouteLayers";
import { directionPath, drawAllJeepneyRoutes, hideJeepneyRoutes, showJeepneyRoutes, type RouteDirectionKey } from "./mapbox/jeepneyRouteLayers";
import { addPlaceMarker, POPUP_PORTAL_ID, updatePlaceMarkerVisibility } from "./mapbox/placeMarkers";
import { addDestinationMarker, addRouteEndpointPins, addUserMarker, removeMarkers } from "./mapbox/routeMarkers";
import { drawZone, showZones } from "./mapbox/zoneLayers";
import MobileSheet from "./mobile/MobileSheet";
import { mapViewPadding } from "./mobile/sheetLayout";
import { paintRouteDrawing } from "./routeDrawing/paintRouteDrawing";
import { roadRouteSteps, showRoadRoute } from "./routeDrawing/roadRoute";
import { buildTransitDrawing } from "./routeDrawing/transitRoute";
import { buildTricycleDrawing } from "./routeDrawing/tricycleRoute";
import type { RouteDrawing } from "./routeDrawing/types";
import type { PanelProps } from "./panels/types";
import Sidebar from "./sidebar";

mapboxgl.accessToken = MAPBOX_TOKEN;

const ALL_ROUTE_IDS = mockRoutes.map((r) => r.id);
const ALL_ZONE_IDS = tricycleZones.map((z) => z.id);
const PLACE_FOCUS_ZOOM = 17; // amenity markers only appear from 16.5 up (see placeMarkers.ts)
const ON_LOAD_GPS_TIMEOUT_MS = 15000; // first-time permission prompts often take longer than 5s to answer
const NAVIGATION_GPS_TIMEOUT_MS = 10000;

export default function MapComponent() {
  // ---- Places and search ----
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoadingAmenities, setIsLoadingAmenities] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  // ---- Trip origin ----
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [isPickingOrigin, setIsPickingOrigin] = useState(false);
  /** The automatic on-load GPS attempt failed (mobile only) — offer a retry. */
  const [gpsFailed, setGpsFailed] = useState(false);

  // ---- Routing ----
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  /** Step-by-step list for the drawn jeepney/tricycle option (road modes derive theirs from roadRoutes). */
  const [drawnSteps, setDrawnSteps] = useState<DirectionsStep[]>([]);
  const [roadRoutes, setRoadRoutes] = useState<DirectionsRoute[]>([]); // driving / walking / motor
  const [activeRoadIdx, setActiveRoadIdx] = useState(0);
  const [transitCandidates, setTransitCandidates] = useState<TransitCandidate[]>([]);
  const [activeTransitIdx, setActiveTransitIdx] = useState(0);
  const [tricyclePlan, setTricyclePlan] = useState<TricycleTripPlan>(NO_TRICYCLE_PLAN);
  const [activeTricycleIdx, setActiveTricycleIdx] = useState(0);

  // ---- Map layers and layout ----
  const [visibleRouteIds, setVisibleRouteIds] = useState<string[]>(ALL_ROUTE_IDS);
  const [isolatedDirectionId, setIsolatedDirectionId] = useState<string | null>(null);
  const [visibleZoneIds, setVisibleZoneIds] = useState<string[]>(ALL_ZONE_IDS);

  // ---- Mapbox objects ----
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  const placeMarkers = useRef<mapboxgl.Marker[]>([]);
  const routePills = useRef<mapboxgl.Marker[]>([]); // "Board here / Get down" labels on the active route
  const routeEndpointPins = useRef<mapboxgl.Marker[]>([]); // Start/End of an isolated jeepney route
  /** Read inside the map's click handler, which is registered once and would otherwise see stale state. */
  const isPickingOriginRef = useRef(false);
  /** Increments on every route draw; an async draw that finishes after a newer one started is discarded. */
  const drawGeneration = useRef(0);

  // =====================================================
  // Origin: GPS and dropped pins
  // =====================================================

  /** Silent GPS lookup on page load (mobile only); sets the origin and flies there. */
  const locateUser = async () => {
    try {
      const coords = await getCurrentCoords(ON_LOAD_GPS_TIMEOUT_MS);
      setGpsFailed(false);
      setOrigin({ name: "My Current Location", coords });
      userMarker.current?.setLngLat(coords);
      map.current?.flyTo({ center: coords, zoom: 15, duration: 2000 });
    } catch (error) {
      console.warn("GPS request failed or timed out:", error);
      // Desktops rarely have real GPS — don't nag with a retry prompt there.
      if (isMobileDevice()) setGpsFailed(true);
    }
  };

  /** GPS lookup when starting navigation; falls back to asking for a dropped pin. Setting the origin triggers routing. */
  const setOriginFromGps = async () => {
    try {
      const coords = await getCurrentCoords(NAVIGATION_GPS_TIMEOUT_MS);
      const name = await reverseGeocode(coords, "Current Location");
      setOrigin({ name, coords });
      userMarker.current?.setLngLat(coords);
    } catch (error) {
      console.warn("GPS failed, switching to manual pin mode:", error);
      setIsPickingOrigin(true);
    }
  };

  useEffect(() => {
    isPickingOriginRef.current = isPickingOrigin;
  }, [isPickingOrigin]);

  // =====================================================
  // Starting, running and closing a trip
  // =====================================================

  const startNavigationFlow = (place: Place) => {
    setSelectedPlace(place);
    setIsRoutingMode(true);
    // Some destinations exclude a mode (a tricycle stand excludes Tricycle).
    if (place.excludeModes?.includes(travelMode)) setTravelMode("transit");

    if (isMobileDevice()) void setOriginFromGps();
    else setIsPickingOrigin(true); // the "Click anywhere on the map…" banner explains what to do
  };

  const clearRoutePills = () => {
    removeMarkers(routePills.current);
    routePills.current = [];
  };

  /** Removes the active route, its pills and the destination marker from the map. */
  const clearRouteFromMap = () => {
    if (map.current) hideActiveRoute(map.current);
    destinationMarker.current?.remove();
    destinationMarker.current = null;
    clearRoutePills();
  };

  /** Finds routes from `start` to `place` in `mode`. Results land in state; the draw effect below puts them on the map. */
  const requestRoute = async (place: Place, mode: TravelMode, start: number[]) => {
    const currentMap = map.current;
    const end: [number, number] = [Number(place.lon), Number(place.lat)];
    if (!currentMap || isNaN(end[0]) || isNaN(end[1])) return;

    clearRoutePills();
    setDrawnSteps([]);
    setRoadRoutes([]);
    setTricyclePlan(NO_TRICYCLE_PLAN);
    setActiveTricycleIdx(0);
    hideJeepneyRoutes(currentMap);
    destinationMarker.current?.remove();
    destinationMarker.current = addDestinationMarker(currentMap, end);

    try {
      // Jeepney options are always computed: the summary card shows them in every mode.
      setTransitCandidates(findTransitRouteCandidates(start, end));
      setActiveTransitIdx(0);
      if (mode === "transit") return;

      if (mode === "tricycle") {
        const plan = planTricycleTrip(start, end);
        setTricyclePlan(plan);
        if (plan.routes.length === 0) {
          hideActiveRoute(currentMap); // nothing to draw — clear what the previous mode left
        }
        return;
      }

      const routes = await fetchRoadRoutes(mode, start, end);
      if (routes.length > 0) {
        setRoadRoutes(routes);
        setActiveRoadIdx(0);
      }
    } catch (error) {
      console.error("Routing Error:", error);
    }
  };

  // Re-route whenever the trip's ends or the travel mode change.
  // requestRoute is re-created every render, so it is left out of the deps (listing
  // it would re-route on every render). It resets the previous results as it starts.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isRoutingMode && origin && selectedPlace) void requestRoute(selectedPlace, travelMode, origin.coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, travelMode, isRoutingMode, selectedPlace]);

  /** Paints a jeepney/tricycle drawing once it's ready, unless a newer draw has started meanwhile. */
  const showDrawing = async (drawing: RouteDrawing | Promise<RouteDrawing>) => {
    const generation = ++drawGeneration.current;
    const ready = await drawing;
    if (generation !== drawGeneration.current || !map.current) return;

    clearRoutePills();
    routePills.current = paintRouteDrawing(map.current, ready);
    setDrawnSteps(ready.steps);
  };

  // Draw the selected option of the current mode.
  useEffect(() => {
    const currentMap = map.current;
    if (!isRoutingMode || !currentMap) return;

    if (travelMode === "transit") {
      const plan = transitCandidates[activeTransitIdx];
      if (plan && origin && selectedPlace) {
        void showDrawing(buildTransitDrawing(plan, origin.coords, [Number(selectedPlace.lon), Number(selectedPlace.lat)]));
      }
      return;
    }

    if (travelMode === "tricycle") {
      const route = tricyclePlan.routes[activeTricycleIdx];
      if (route) void showDrawing(buildTricycleDrawing(route));
      return;
    }

    // Driving / walking / motor. Show or hide walking dots at once, so dots
    // from a previous mode don't linger while the new routes load.
    drawGeneration.current++; // discard any jeepney draw still in flight
    setWalkDotsVisible(currentMap, travelMode === "walking");
    const route = roadRoutes[activeRoadIdx];
    if (route) showRoadRoute(currentMap, route, travelMode);
    // showDrawing is re-created every render; it only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoadIdx, roadRoutes, activeTransitIdx, transitCandidates, tricyclePlan, activeTricycleIdx, travelMode, isRoutingMode]);

  const closeRouting = () => {
    setIsRoutingMode(false);
    setIsPickingOrigin(false);
    setDrawnSteps([]);
    setRoadRoutes([]);
    setActiveRoadIdx(0);
    setTransitCandidates([]);
    setActiveTransitIdx(0);
    setTricyclePlan(NO_TRICYCLE_PLAN);
    setActiveTricycleIdx(0);
    setIsolatedDirectionId(null);
    removeMarkers(routeEndpointPins.current);
    routeEndpointPins.current = [];
    drawGeneration.current++;

    clearRouteFromMap();
    if (map.current) showJeepneyRoutes(map.current, visibleRouteIds, null);
  };

  const closePlacePopup = () => {
    setSelectedPlace(null);
    clearRouteFromMap();
    if (map.current) showJeepneyRoutes(map.current, visibleRouteIds, isolatedDirectionId);
  };

  const focusPlace = (place: Place) => {
    setSelectedPlace(place);
    map.current?.flyTo({ center: [place.lon, place.lat], zoom: PLACE_FOCUS_ZOOM, padding: mapViewPadding(0, "peek") });
  };

  // =====================================================
  // Jeepney route and zone layers
  // =====================================================

  const clearRouteEndpointPins = () => {
    removeMarkers(routeEndpointPins.current);
    routeEndpointPins.current = [];
  };

  /** Shows one direction of one route on its own (with Start/End pins); selecting it again shows all routes. */
  const selectSingleRoute = (routeId: string, directionId: string) => {
    clearRouteEndpointPins();

    if (isolatedDirectionId === directionId) {
      setIsolatedDirectionId(null);
      setVisibleRouteIds(ALL_ROUTE_IDS);
      return;
    }

    setIsolatedDirectionId(directionId);
    setVisibleRouteIds([routeId]);

    const route = mockRoutes.find((r) => r.id === routeId);
    const direction: RouteDirectionKey = directionId.endsWith("-fwd") ? "fwd" : "rev";
    const path = route && directionPath(route, direction);
    if (!route || !path || !map.current) return;

    routeEndpointPins.current = addRouteEndpointPins(map.current, path, JEEPNEY_LINE_COLORS[route.colorCode]);
    const bounds = new mapboxgl.LngLatBounds();
    path.forEach((coord) => bounds.extend(coord));
    map.current.fitBounds(bounds, { padding: mapViewPadding(100, "peek"), duration: 1000 });
  };

  const toggleRouteColor = (color: JeepneyColor) => {
    setIsolatedDirectionId(null);
    clearRouteEndpointPins();
    const ids = mockRoutes.filter((r) => r.colorCode === color).map((r) => r.id);
    const allVisible = ids.every((id) => visibleRouteIds.includes(id));
    setVisibleRouteIds((prev) => (allVisible ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))));
  };

  const setAllRoutesVisible = (visible: boolean) => {
    setVisibleRouteIds(visible ? ALL_ROUTE_IDS : []);
    setIsolatedDirectionId(null);
    clearRouteEndpointPins();
  };

  const toggleZone = (zoneId: string) =>
    setVisibleZoneIds((prev) => (prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]));

  useEffect(() => {
    if (map.current?.isStyleLoaded()) showJeepneyRoutes(map.current, visibleRouteIds, isolatedDirectionId);
  }, [visibleRouteIds, isolatedDirectionId]);

  useEffect(() => {
    if (map.current?.isStyleLoaded()) showZones(map.current, tricycleZones, visibleZoneIds);
  }, [visibleZoneIds]);

  // =====================================================
  // One-time setup
  // =====================================================

  useEffect(() => {
    // Desktop geolocation guesses from IP (often a whole city off), so only phones look themselves up.
    // locateUser only sets state once the GPS answers, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isMobileDevice()) void locateUser();
  }, []);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return;

    const currentMap = new mapboxgl.Map({ container: mapContainer.current, style: MAP_STYLE, center: DEFAULT_CITY_CENTER, zoom: DEFAULT_ZOOM });
    map.current = currentMap;
    userMarker.current = addUserMarker(currentMap, DEFAULT_CITY_CENTER);

    const addMarkers = (list: Place[]) => {
      for (const place of list) placeMarkers.current.push(addPlaceMarker(currentMap, place, setSelectedPlace));
    };
    const refreshMarkerVisibility = () => updatePlaceMarkerVisibility(placeMarkers.current, currentMap.getZoom());

    currentMap.on("load", async () => {
      drawAllJeepneyRoutes(currentMap);
      tricycleZones.forEach((zone) => drawZone(currentMap, zone, true, () => !isPickingOriginRef.current));

      // Stands (and stops) are local data: show them at once, not after the slow amenities fetch.
      addMarkers(TRICYCLE_STAND_PLACES);
      if (SHOW_JEEPNEY_STOPS) addMarkers(JEEPNEY_STOP_PLACES);
      const localPlaces = SHOW_JEEPNEY_STOPS ? [...TRICYCLE_STAND_PLACES, ...JEEPNEY_STOP_PLACES] : TRICYCLE_STAND_PLACES;
      setPlaces(localPlaces);

      try {
        const res = await fetch("/api/amenities");
        const amenities = parseAmenities(await res.json());
        setPlaces([...amenities, ...localPlaces]);
        addMarkers(amenities);
        refreshMarkerVisibility();
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingAmenities(false);
      }

      currentMap.on("zoomend", refreshMarkerVisibility);
      currentMap.on("moveend", refreshMarkerVisibility);
    });

    // Dropping a pin sets the trip origin.
    currentMap.on("click", (e) => {
      if (!isPickingOriginRef.current) return;
      setOrigin({ name: `Dropped Pin (${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)})`, coords: [e.lngLat.lng, e.lngLat.lat] });
      setIsPickingOrigin(false);
      userMarker.current?.setLngLat(e.lngLat);
    });

    return () => {
      currentMap.remove();
      map.current = null;
    };
  }, []);

  // =====================================================
  // Layout
  // =====================================================

  const filteredPlaces = places.filter((place) => matchesSearch(place, searchQuery));
  const isRoadMode = travelMode === "driving" || travelMode === "walking" || travelMode === "cycling";
  const activeRoadRoute = roadRoutes[activeRoadIdx];
  const routeSteps = isRoadMode ? (activeRoadRoute ? roadRouteSteps(activeRoadRoute, travelMode) : []) : drawnSteps;
  const popupRoot = selectedPlace ? document.getElementById(POPUP_PORTAL_ID) : null;

  const panelProps: PanelProps = {
    isRoutingMode,
    isPickingOrigin,
    // browsing
    places: filteredPlaces,
    isLoadingAmenities,
    searchQuery,
    visibleRouteIds,
    isolatedDirectionId,
    onSelectRoute: selectSingleRoute,
    onSelectPlace: focusPlace,
    onStartNavigation: startNavigationFlow,
    // directions
    origin,
    destination: selectedPlace,
    mode: travelMode,
    setMode: setTravelMode,
    routeSteps,
    onSelectOriginMode: () => setIsPickingOrigin(true),
    onCloseRouting: closeRouting,
    roadRoutes,
    activeRoadIdx,
    setActiveRoadIdx,
    transitCandidates,
    activeTransitIdx,
    setActiveTransitIdx,
    tricycleRoutes: tricyclePlan.routes,
    activeTricycleIdx,
    setActiveTricycleIdx,
    tricycleWalkOnly: tricyclePlan.walkBeatsTricycle,
    tricycleWalkMinutes: tricyclePlan.walkMinutes,
  };

  return (
    <div className="relative w-full h-screen overflow-hidden flex">
      {/* Desktop: sidebar. Phones and tablets: bottom sheet. Same contents. */}
      <Sidebar {...panelProps} />
      <MobileSheet {...panelProps} />

      {isPickingOrigin && (
        <MapBanner
          tone="info"
          message={isMobileDevice() ? "Tap the map to set your starting point" : "Click anywhere on the map to set your starting point"}
          dismissLabel="Cancel"
          onDismiss={() => setIsPickingOrigin(false)}
        />
      )}

      {gpsFailed && !origin && !isPickingOrigin && (
        <MapBanner tone="warning" message="Couldn't get your location" dismissLabel="Dismiss" onDismiss={() => setGpsFailed(false)}>
          <button
            onClick={() => void locateUser()}
            className="flex-shrink-0 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-full hover:bg-blue-50 transition-colors"
          >
            Retry
          </button>
        </MapBanner>
      )}

      <div className="relative flex-1 h-full">
        <div className="absolute top-4 left-4 right-4 z-10 flex items-start gap-2">
          <SearchBox value={searchQuery} onChange={setSearchQuery} />

          <LayersPanel
            visibleRouteIds={visibleRouteIds}
            onToggleRouteColor={toggleRouteColor}
            onSetAllRoutesVisible={setAllRoutesVisible}
            visibleZoneIds={visibleZoneIds}
            onToggleZone={toggleZone}
            onShowAllZones={() => setVisibleZoneIds(ALL_ZONE_IDS)}
          />
        </div>

        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {selectedPlace &&
          popupRoot &&
          createPortal(
            <AmenityPopupBox place={selectedPlace} onClose={closePlacePopup} onGetDirections={() => startNavigationFlow(selectedPlace)} />,
            popupRoot
          )}
      </div>
    </div>
  );
}
