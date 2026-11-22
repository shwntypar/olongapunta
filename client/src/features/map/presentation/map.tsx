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
//   ../application/  routing: Mapbox Directions, jeepney matcher, Martins (tricycle, mixed)
//   ../domain/       data: routes, zones, places, shared types

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { routesNotRunning, TRIP_MIN_SAVING_MIN } from "../application/jeepney/transitCandidates";
import { fetchRoadRoutes } from "../application/mapboxDirections";
import { requestMixedTrip } from "../application/martins/mixedTripClient";
import { NO_MIXED_PLAN, type MixedTripPlan } from "../application/martins/planMixedTrip";
import { NO_TRICYCLE_PLAN, planTricycleTrip, type TricycleTripPlan } from "../application/martins/planTricycleTrip";
import { DEFAULT_CITY_CENTER, DEFAULT_ZOOM, MAP_STYLE, MAPBOX_TOKEN, SHOW_JEEPNEY_STOPS } from "../config";
import { JEEPNEY_LINE_COLORS } from "../domain/jeepneyColors";
import { mockRoutes, type JeepneyColor } from "../domain/MockData";
import { describeStandLocations, JEEPNEY_STOP_PLACES, parseAmenities, searchPlaces, TRICYCLE_STAND_PLACES } from "../domain/places";
import { routePath, type RouteDirectionKey } from "../domain/routeGeometry";
import { tricycleZones } from "../domain/TricycleZoneData";
import type { JeepneyRoute } from "../domain/MockData";
import type { DirectionsRoute, DirectionsStep, Origin, Place, TravelMode } from "../domain/types";
import { isMobileDevice } from "../utils/device";
import { getCurrentCoords, reverseGeocode } from "../utils/geolocation";

import LayersPanel from "./components/LayersPanel";
import MapBanner from "./components/MapBanner";
import SearchBox from "./components/SearchBox";
import { hideActiveRoute, setWalkDotsVisible } from "./mapbox/activeRouteLayers";
import { drawAllJeepneyRoutes, hideJeepneyRoutes, showJeepneyRoutes } from "./mapbox/jeepneyRouteLayers";
import { addPlaceMarker, closeAllPopups, openPlacePopup, POPUP_PORTAL_ID, updatePlaceMarkerVisibility } from "./mapbox/placeMarkers";
import { addDestinationMarker, addRouteEndpointPins, addUserMarker, removeMarkers } from "./mapbox/routeMarkers";
import { drawZone, showZones } from "./mapbox/zoneLayers";
import MobileSheet from "./mobile/MobileSheet";
import { mapViewPadding, usesBottomSheet } from "./mobile/sheetLayout";
import { paintRouteDrawing } from "./routeDrawing/paintRouteDrawing";
import { roadRouteSteps, showRoadRoute } from "./routeDrawing/roadRoute";
import { buildMixedDrawing } from "./routeDrawing/mixedRoute";
import { buildTricycleDrawing } from "./routeDrawing/tricycleRoute";
import type { RouteDrawing } from "./routeDrawing/types";
import type { PanelProps } from "./panels/types";
import PlaceDetailsCard from "./placeDetails/PlaceDetailsCard";
import Sidebar from "./sidebar";

mapboxgl.accessToken = MAPBOX_TOKEN;

const ALL_ROUTE_IDS = mockRoutes.map((r) => r.id);
const ALL_ZONE_IDS = tricycleZones.map((z) => z.id);
const PLACE_FOCUS_ZOOM = 17; // amenity markers only appear from 16.5 up (see placeMarkers.ts)
const ON_LOAD_GPS_TIMEOUT_MS = 15000; // first-time permission prompts often take longer than 5s to answer
const NAVIGATION_GPS_TIMEOUT_MS = 10000;

/** No jeepney found, or the best one doesn't beat walking by TRIP_MIN_SAVING_MIN — Transit then notes the walk and suggests other ways. */
function savesLittle(plan: MixedTripPlan): boolean {
  const best = plan.routes[0];
  return !best || (plan.walkMinutes !== null && best.cost[0] > plan.walkMinutes - TRIP_MIN_SAVING_MIN);
}

export default function MapComponent() {
  // ---- Places and search ----
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoadingAmenities, setIsLoadingAmenities] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  /** The place being browsed — and, in directions mode, the trip's destination. */
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  /**
   * Directions mode only: another place whose card is open because its marker
   * was tapped. Looking at it never changes the trip; its card's "Get
   * Directions" does, on purpose.
   */
  const [peekPlace, setPeekPlace] = useState<Place | null>(null);

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
  /** Transit: jeepney-only trips from the network search (any number of transfers). */
  const [transitPlan, setTransitPlan] = useState<MixedTripPlan>(NO_MIXED_PLAN);
  const [isPlanningTransit, setIsPlanningTransit] = useState(false);
  /** Routes that would serve the trip but aren't running at this hour. */
  const [transitNotRunning, setTransitNotRunning] = useState<JeepneyRoute[]>([]);
  /** On the Transit tab, when no jeepney clearly wins: the fastest tricycle, to offer instead. */
  const [transitTricycle, setTransitTricycle] = useState<{ minutes: number; fare: number } | null>(null);
  const [activeTransitIdx, setActiveTransitIdx] = useState(0);
  const [tricyclePlan, setTricyclePlan] = useState<TricycleTripPlan>(NO_TRICYCLE_PLAN);
  const [activeTricycleIdx, setActiveTricycleIdx] = useState(0);
  const [mixedPlan, setMixedPlan] = useState<MixedTripPlan>(NO_MIXED_PLAN);
  const [activeMixedIdx, setActiveMixedIdx] = useState(0);
  const [isPlanningMixed, setIsPlanningMixed] = useState(false);

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
  /** Same, for directions mode (read by the marker click handler). */
  const isRoutingModeRef = useRef(false);
  /** A trip is on screen: place markers stay hidden (read on every zoom/pan by the map's visibility refresh). */
  const hidePlaceMarkersRef = useRef(false);
  /** Increments on every route draw; an async draw that finishes after a newer one started is discarded. */
  const drawGeneration = useRef(0);
  /** Increments on every route request; an async result for an older request is discarded. */
  const routeRequest = useRef(0);

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

  useEffect(() => {
    isRoutingModeRef.current = isRoutingMode;
  }, [isRoutingMode]);

  // While a trip is shown, hide the place markers — only the trip's own pins and labels stay. They stay
  // visible while choosing the start, so a stand or shop can be tapped to start from it.
  useEffect(() => {
    hidePlaceMarkersRef.current = isRoutingMode && !isPickingOrigin;
    if (map.current) updatePlaceMarkerVisibility(placeMarkers.current, map.current.getZoom(), hidePlaceMarkersRef.current);
  }, [isRoutingMode, isPickingOrigin]);

  // The always-on jeepney network: shown while browsing, hidden while showing a trip (it would bury the trip's route).
  // The one place that decides this — layer toggles and closing cards no longer bring it back mid-trip.
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap) return; // layers not drawn yet are skipped inside show/hide
    if (isRoutingMode) hideJeepneyRoutes(currentMap);
    else showJeepneyRoutes(currentMap, visibleRouteIds, isolatedDirectionId);
  }, [isRoutingMode, visibleRouteIds, isolatedDirectionId]);

  // =====================================================
  // Starting, running and closing a trip
  // =====================================================

  const startNavigationFlow = (place: Place) => {
    closeAllPopups(); // the place card would cover the route
    setPeekPlace(null);
    setSelectedPlace(place);
    setIsRoutingMode(true);
    // Some destinations exclude a mode (a tricycle stand excludes Tricycle).
    if (place.excludeModes?.includes(travelMode)) setTravelMode("transit");

    // Already showing a trip (switching destination from a peeked card): keep the start the rider chose.
    if (isRoutingMode && origin) return;
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
    const requestId = ++routeRequest.current;

    clearRoutePills();
    setDrawnSteps([]);
    setRoadRoutes([]);
    setTransitPlan(NO_MIXED_PLAN);
    setIsPlanningTransit(false);
    setTransitNotRunning([]);
    setTransitTricycle(null);
    setActiveTransitIdx(0);
    setTricyclePlan(NO_TRICYCLE_PLAN);
    setActiveTricycleIdx(0);
    setMixedPlan(NO_MIXED_PLAN);
    setActiveMixedIdx(0);
    setIsPlanningMixed(false);
    destinationMarker.current?.remove();
    destinationMarker.current = addDestinationMarker(currentMap, end);

    try {
      if (mode === "transit") {
        // The same network search as Mixed with tricycles off: jeepney trips with any number of
        // transfers, walking on real streets. Runs in the Web Worker; the same trip asked again is reused.
        drawGeneration.current++;
        hideActiveRoute(currentMap);
        setIsPlanningTransit(true);
        const plan = await requestMixedTrip(start, end, { tricycles: false });
        if (requestId !== routeRequest.current) return; // the trip or mode changed while it ran
        setTransitPlan(plan);
        setTransitNotRunning(routesNotRunning(start, end, new Date()));
        if (savesLittle(plan)) {
          // Not just "walk": also offer the tricycle, with its time and fare (fast — tens of ms).
          const fastest = planTricycleTrip(start, end).routes[0];
          setTransitTricycle(fastest ? { minutes: Math.round(fastest.cost[0]), fare: fastest.cost[1] } : null);
        }
        setIsPlanningTransit(false);
        return;
      }

      if (mode === "tricycle") {
        const plan = planTricycleTrip(start, end);
        setTricyclePlan(plan);
        if (plan.routes.length === 0) {
          hideActiveRoute(currentMap); // nothing to draw — clear what the previous mode left
        }
        return;
      }

      if (mode === "mixed") {
        // Runs in a Web Worker (a long trip takes over a second). Clear the
        // previous mode's drawing meanwhile so it isn't mistaken for the result.
        drawGeneration.current++;
        hideActiveRoute(currentMap);
        setIsPlanningMixed(true);
        const plan = await requestMixedTrip(start, end);
        if (requestId !== routeRequest.current) return; // the trip or mode changed while it ran
        setMixedPlan(plan);
        setIsPlanningMixed(false);
        return;
      }

      const routes = await fetchRoadRoutes(mode, start, end);
      if (requestId !== routeRequest.current) return;
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

  // Draw the selected option of the current mode. When the mode has nothing
  // to show (no jeepney worth taking, no tricycle zone, still loading), clear
  // the map — otherwise the previous mode's route stays up and reads as this one.
  useEffect(() => {
    const currentMap = map.current;
    if (!isRoutingMode || !currentMap) return;

    const clearDrawnRoute = () => {
      drawGeneration.current++; // discard any draw still in flight
      hideActiveRoute(currentMap);
      clearRoutePills();
    };

    if (travelMode === "transit") {
      const route = transitPlan.routes[activeTransitIdx];
      if (route) void showDrawing(buildMixedDrawing(route));
      else clearDrawnRoute();
      return;
    }

    if (travelMode === "tricycle") {
      const route = tricyclePlan.routes[activeTricycleIdx];
      if (route) void showDrawing(buildTricycleDrawing(route));
      else clearDrawnRoute();
      return;
    }

    if (travelMode === "mixed") {
      const route = mixedPlan.routes[activeMixedIdx];
      if (route) void showDrawing(buildMixedDrawing(route));
      else clearDrawnRoute();
      return;
    }

    // Driving / walking / motor. Show or hide walking dots at once, so dots
    // from a previous mode don't linger while the new routes load.
    setWalkDotsVisible(currentMap, travelMode === "walking");
    const route = roadRoutes[activeRoadIdx];
    if (route) {
      drawGeneration.current++; // discard any jeepney draw still in flight
      clearRoutePills();
      showRoadRoute(currentMap, route, travelMode);
    } else clearDrawnRoute();
    // showDrawing is re-created every render; it only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoadIdx, roadRoutes, activeTransitIdx, transitPlan, tricyclePlan, activeTricycleIdx, mixedPlan, activeMixedIdx, travelMode, isRoutingMode]);

  const closeRouting = () => {
    setIsRoutingMode(false);
    setIsPickingOrigin(false);
    setDrawnSteps([]);
    setRoadRoutes([]);
    setActiveRoadIdx(0);
    setTransitPlan(NO_MIXED_PLAN);
    setIsPlanningTransit(false);
    setTransitNotRunning([]);
    setTransitTricycle(null);
    setActiveTransitIdx(0);
    setTricyclePlan(NO_TRICYCLE_PLAN);
    setActiveTricycleIdx(0);
    setMixedPlan(NO_MIXED_PLAN);
    setActiveMixedIdx(0);
    setIsPlanningMixed(false);
    routeRequest.current++; // drop any mixed search still running
    setIsolatedDirectionId(null);
    removeMarkers(routeEndpointPins.current);
    routeEndpointPins.current = [];
    drawGeneration.current++;

    setPeekPlace(null);
    closeAllPopups();
    clearRouteFromMap();
  };

  const closePlacePopup = () => {
    closeAllPopups();
    if (isRoutingMode) {
      setPeekPlace(null); // only the peeked card closes — the trip stays as it is
      return;
    }
    setSelectedPlace(null);
    clearRouteFromMap();
  };

  /** From the lists: fly to the place and open its card. */
  const focusPlace = (place: Place) => {
    if (map.current) openPlacePopup(map.current, place);
    setSelectedPlace(place);
    // Place the marker below centre: its card opens above it and can be tall.
    map.current?.flyTo({ center: [place.lon, place.lat], zoom: PLACE_FOCUS_ZOOM, padding: mapViewPadding(0, "peek"), offset: [0, usesBottomSheet() ? 150 : 190] });
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
    const path = route && routePath(route, direction);
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
    // Layers that aren't drawn yet are skipped inside showZones, so no "style loaded" gate — that flag
    // can read false while tiles are still loading, which silently dropped the change.
    if (map.current) showZones(map.current, tricycleZones, visibleZoneIds);
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

    /**
     * A tapped marker. Registered once, so it reads modes through refs:
     *   choosing the start → the start is set at that place;
     *   directions mode    → its card opens (peek), the trip doesn't change;
     *   browsing           → it becomes the selected place, card open.
     */
    const onMarkerTap = (place: Place) => {
      if (isPickingOriginRef.current) {
        setOrigin({ name: place.name, coords: [place.lon, place.lat] });
        setIsPickingOrigin(false);
        userMarker.current?.setLngLat([place.lon, place.lat]);
        return;
      }
      openPlacePopup(currentMap, place);
      if (isRoutingModeRef.current) setPeekPlace(place);
      else setSelectedPlace(place);
    };
    const addMarkers = (list: Place[]) => {
      for (const place of list) placeMarkers.current.push(addPlaceMarker(currentMap, place, onMarkerTap));
    };
    const refreshMarkerVisibility = () => updatePlaceMarkerVisibility(placeMarkers.current, currentMap.getZoom(), hidePlaceMarkersRef.current);

    currentMap.on("load", async () => {
      drawAllJeepneyRoutes(currentMap);
      if (isRoutingModeRef.current) hideJeepneyRoutes(currentMap); // a trip started before the map finished loading
      tricycleZones.forEach((zone) => drawZone(currentMap, zone, true, () => !isPickingOriginRef.current));

      // Stands (and stops) are local data: show them at once, not after the slow amenities fetch.
      addMarkers(TRICYCLE_STAND_PLACES);
      if (SHOW_JEEPNEY_STOPS) addMarkers(JEEPNEY_STOP_PLACES);
      const localPlaces = SHOW_JEEPNEY_STOPS ? [...TRICYCLE_STAND_PLACES, ...JEEPNEY_STOP_PLACES] : TRICYCLE_STAND_PLACES;
      setPlaces(localPlaces);

      try {
        const res = await fetch("/api/amenities");
        const amenities = parseAmenities(await res.json());
        describeStandLocations(amenities); // "… · by Jollibee (40 m)" on each stand, now that landmarks are known
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

  const filteredPlaces = searchPlaces(places, searchQuery);
  const isRoadMode = travelMode === "driving" || travelMode === "walking" || travelMode === "cycling";
  const activeRoadRoute = roadRoutes[activeRoadIdx];
  const routeSteps = isRoadMode ? (activeRoadRoute ? roadRouteSteps(activeRoadRoute, travelMode) : []) : drawnSteps;
  /** The place whose card is open: a peeked place in directions mode, otherwise the selected one. */
  const cardPlace = isRoutingMode ? peekPlace : selectedPlace;
  const popupRoot = cardPlace ? document.getElementById(POPUP_PORTAL_ID) : null;

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
    transitRoutes: transitPlan.routes,
    activeTransitIdx,
    setActiveTransitIdx,
    isPlanningTransit,
    transitWalkMinutes: transitPlan.walkMinutes,
    transitSavesLittle: savesLittle(transitPlan),
    transitNotRunning,
    transitTricycle,
    tricycleRoutes: tricyclePlan.routes,
    activeTricycleIdx,
    setActiveTricycleIdx,
    tricycleWalkOnly: tricyclePlan.walkBeatsTricycle,
    tricycleWalkMinutes: tricyclePlan.walkMinutes,
    mixedRoutes: mixedPlan.routes,
    activeMixedIdx,
    setActiveMixedIdx,
    isPlanningMixed,
    mixedWalkOnly: mixedPlan.walkBeatsRiding,
    mixedWalkMinutes: mixedPlan.walkMinutes,
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
            onSetAllZonesVisible={(visible) => setVisibleZoneIds(visible ? ALL_ZONE_IDS : [])}
          />
        </div>

        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {cardPlace &&
          popupRoot &&
          createPortal(
            <PlaceDetailsCard
              key={cardPlace.id}
              place={cardPlace}
              from={origin?.coords}
              onClose={closePlacePopup}
              onGetDirections={() => startNavigationFlow(cardPlace)}
            />,
            popupRoot
          )}
      </div>
    </div>
  );
}
