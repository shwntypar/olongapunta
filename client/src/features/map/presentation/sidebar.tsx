"use client";

import React, { useEffect, useState } from "react";
import { mockRoutes } from "../domain/MockData";
import { tricycleZones } from "../domain/TricycleZoneData";
import type { RouteLeg } from "../application/martins/types";
import RouteSummaryCard, { type RouteSummary } from "./route-summary-card";

export type TravelMode = "driving" | "walking" | "cycling" | "transit" | "tricycle";

// A tricycle ride at least this long (km, summed over every ride in the
// route) shows the fuel-price note under the fare. 2 km matches the flat-fare
// allowance (includedKm in TricycleZoneData.ts) — past it, the fare is the
// driver's per-km call, which is where fuel prices hit the rider hardest.
const LONG_TRICYCLE_TRIP_KM = 2;

/** Length (km) of a [lon, lat][] path — haversine, no Turf needed for a display-only figure. */
function pathLengthKm(coords: [number, number][]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  let km = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const h =
      Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
    km += 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  return km;
}

interface SidebarProps {
  places: any[];
  isLoadingAmenities?: boolean;
  userLocation: number[];
  origin: { name: string; coords: number[] } | null;
  destination: any | null;
  mode: TravelMode;
  isRoutingMode: boolean;
  setMode: (mode: TravelMode) => void;
  routeInstructions: any[];
  visibleRouteIds: string[];
  isolatedDirectionId: string | null;
  onSelectOriginMode: () => void;
  onSelectRoute: (routeId: string, directionId: string) => void;
  onCloseRouting: () => void;
  onSelectPlace: (place: any) => void;
  onStartNavigation: (place: any) => void;

  // 📱 Responsive drawer control (mobile/tablet only — always open on desktop)
  isOpen?: boolean;
  onClose?: () => void;

  // 🚗 Alternative Paths Props (Driving, Walking, Motor)
  alternativeRoutes?: any[];
  activeRouteIdx?: number;
  setActiveRouteIdx?: (idx: number) => void;

  // 🚐 Transit Candidate Props (Alternatives)
  transitCandidates?: any[];
  activeTransitIdx?: number;
  setActiveTransitIdx?: (idx: number) => void;

  // 🛺🧭 Tricycle Candidate Props (Martins' Pareto routes)
  martinsRoutes?: any[];
  activeMartinsIdx?: number;
  setActiveMartinsIdx?: (idx: number) => void;
  tricycleWalkOnly?: boolean;
  /** Walking time (min) when walking beat every tricycle option; null otherwise. */
  tricycleWalkMinutes?: number | null;
}

export default function Sidebar({
  places,
  isLoadingAmenities = false,
  origin,
  destination,
  mode,
  isRoutingMode,
  setMode,
  routeInstructions,
  visibleRouteIds,
  isolatedDirectionId,
  onSelectOriginMode,
  onSelectRoute,
  onCloseRouting,
  onSelectPlace,
  onStartNavigation,

  isOpen = true,
  onClose,

  // Alternative paths (Walking, Motor, Driving)
  alternativeRoutes = [],
  activeRouteIdx = 0,
  setActiveRouteIdx,

  // Transit options list
  transitCandidates = [],
  activeTransitIdx = 0,
  setActiveTransitIdx,

  // Tricycle candidates list (Martins' Pareto routes)
  martinsRoutes = [],
  activeMartinsIdx = 0,
  setActiveMartinsIdx,
  tricycleWalkOnly = false,
  tricycleWalkMinutes = null,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"explore" | "routes" | "stops">("explore");

  // Nearby places now live in the mobile bottom sheet (Google Maps-style),
  // so the drawer on small screens should open straight into Jeepney Routes.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setActiveTab("routes");
    }
  }, []);

  // Get hex color for display mapping
  const getJeepneyHexColor = (colorName: string) => {
    const colors: Record<string, string> = {
      YELLOW: "#eab308",
      BLUE: "#2563eb",
      RED: "#dc2626",
      GREEN: "#16a34a",
      ORANGE: "#f97316",
      CREAM: "#fef08a",
      BROWN: "#78350f",
      WHITE: "#94a3b8",
    };
    return colors[colorName] || "#64748b";
  };

  // Estimate Fare for Jeepney or Tricycle instructions
  const estimateFare = (instructionText: string) => {
    // An explicit peso amount in the instruction (e.g. Martins' Pareto routes,
    // which already know their real fare) always wins over guessing from a
    // route code.
    const explicit = instructionText.match(/₱(\d+(?:\.\d+)?)/);
    if (explicit) return `₱${parseFloat(explicit[1]).toFixed(2)}`;

    const match = instructionText.match(/Ride the ([\w-]+)/);
    if (!match) return null;
    const code = match[1];

    const jeepney = mockRoutes.find((r) => r.routeCode === code || r.routeName.includes(code));
    if (jeepney) return `₱${jeepney.baseFare.toFixed(2)}`;

    const zone = tricycleZones.find((z) => z.code === code);
    if (zone) return `₱${zone.baseFare.toFixed(2)}`;

    return "₱13.00";
  };

  // Extract driving metrics from alternativeRoutes
  const activeDriveInfo = alternativeRoutes[activeRouteIdx]
    ? {
        durationMin: Math.round(alternativeRoutes[activeRouteIdx].duration / 60),
        distanceKm: (alternativeRoutes[activeRouteIdx].distance / 1000).toFixed(1),
        summary: alternativeRoutes[activeRouteIdx].summary || "Route",
      }
    : null;

  // Extract transit metrics from activeTransitCandidate
  const activeTransitPlan = transitCandidates[activeTransitIdx];
  const transitFareSum = activeTransitPlan
    ? activeTransitPlan.transfer
      ? activeTransitPlan.jeepney.baseFare + activeTransitPlan.transfer.jeepney.baseFare
      : activeTransitPlan.jeepney.baseFare
    : 13.0;

  // Extract fare/crossing info from the active tricycle (Martins Pareto) route
  const activeMartinsRoute = martinsRoutes[activeMartinsIdx];
  const tricycleFareSum = activeMartinsRoute ? activeMartinsRoute.cost[1] : 0;
  const tricycleCrossesZone = activeMartinsRoute
    ? activeMartinsRoute.legs.some((leg: any) => leg.transition === "trike-cross")
    : false;
  const tricycleBoardCount = activeMartinsRoute
    ? activeMartinsRoute.legs.filter((leg: any) => leg.transition === "board-trike").length
    : 0;

  // Total distance actually ridden on a tricycle (not walked) in the active
  // route — drives the long-trip fuel-price note below the fare summary.
  const tricycleRideKm = activeMartinsRoute
    ? (activeMartinsRoute.legs as RouteLeg[])
        .filter((leg) => leg.transition === "trike-home" || leg.transition === "trike-cross")
        .reduce((km: number, leg) => km + pathLengthKm(leg.coordinates ?? []), 0)
    : 0;
  const isLongTricycleTrip = tricycleRideKm >= LONG_TRICYCLE_TRIP_KM;

  // One summary card for whichever modality is selected — time, distance,
  // fare and route detail all follow the mode and the active option.
  const activeTransitCandidate = transitCandidates[activeTransitIdx];
  const summary: RouteSummary | null =
    mode === "transit"
      ? activeTransitCandidate
        ? {
            durationMin: Math.round(activeTransitCandidate.score * 4),
            fare: transitFareSum,
            note: activeTransitPlan?.transfer ? "1 transfer" : "Direct",
            noteKind: activeTransitPlan?.transfer ? "transfer" : "direct",
          }
        : null
      : mode === "tricycle"
      ? activeMartinsRoute
        ? {
            durationMin: Math.round(activeMartinsRoute.cost[0]),
            distanceKm: (activeMartinsRoute.legs as RouteLeg[])
              .reduce((km: number, leg) => km + pathLengthKm(leg.coordinates ?? []), 0)
              .toFixed(1),
            fare: tricycleFareSum,
            note: tricycleBoardCount >= 2 ? "1 transfer" : "Direct",
            noteKind: tricycleBoardCount >= 2 ? "transfer" : "direct",
          }
        : null
      : activeDriveInfo
      ? {
          durationMin: activeDriveInfo.durationMin,
          distanceKm: activeDriveInfo.distanceKm,
          note: alternativeRoutes.length > 1 ? `Route ${activeRouteIdx + 1} of ${alternativeRoutes.length}` : undefined,
          noteKind: "alternate",
        }
      : null;

  return (
    <>
      {/* Mobile-only backdrop — tap to dismiss the drawer */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-20 bg-gray-900/30 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-30 flex h-full w-full max-w-sm flex-col bg-white text-gray-900 border-r border-gray-200 shadow-xl transition-transform duration-300 ease-in-out lg:static lg:z-20 lg:translate-x-0 lg:shadow-lg ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* App Header — hidden while routing: the Directions card below has
            its own header/close action, and stacking both wastes vertical
            space mobile viewports can't spare. */}
        {!isRoutingMode && (
          <div className="p-4 lg:p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-black bg-gradient-to-r from-blue-600 via-violet-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
                OlongaPunta
              </h1>
              <p className="text-[11px] lg:text-xs text-gray-400 font-semibold tracking-widest uppercase mt-0.5">
                Transit & Explore
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600 border border-gray-200">
                Olongapo City
              </div>
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-900 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {!isRoutingMode ? (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/60">
              <button
                onClick={() => setActiveTab("explore")}
                className={`hidden lg:block flex-1 py-4 text-sm font-bold tracking-wide transition-all border-b-2 ${
                  activeTab === "explore"
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                Explore Places
              </button>
              <button
                onClick={() => setActiveTab("routes")}
                className={`flex-1 py-4 text-sm font-bold tracking-wide transition-all border-b-2 ${
                  activeTab === "routes"
                    ? "border-violet-600 text-violet-600 bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                Jeepney Routes
              </button>
              <button
                onClick={() => setActiveTab("stops")}
                className={`flex-1 py-4 text-sm font-bold tracking-wide transition-all border-b-2 ${
                  activeTab === "stops"
                    ? "border-emerald-600 text-emerald-600 bg-white"
                    : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                Stops
              </button>
            </div>

            {/* Scrollable explore list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
              {activeTab === "stops" ? (
                <div className="space-y-7">
                  <div className="space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
                      Tricycle Zones &amp; Stops
                    </h3>
                    {tricycleZones.map((zone) => {
                      const zoneStops = places.filter(
                        (p) => p.type === "tricycle_stand" && p.zoneId === zone.id
                      );

                      return (
                        <div key={zone.id} className="p-4 rounded-xl border bg-white border-gray-200 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: zone.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {zone.code}
                                </span>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate">
                                  {zone.name}
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-400 mt-1 block">
                                Base fare ₱{zone.baseFare.toFixed(2)} · ₱{zone.farePerKm.toFixed(2)}/km
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            {zoneStops.length === 0 ? (
                              <div className="text-xs text-gray-400 italic px-1 py-1">
                                No surveyed stops yet for this zone.
                              </div>
                            ) : (
                              zoneStops.map((stop) => (
                                <div
                                  key={stop.id}
                                  onClick={() => onSelectPlace(stop)}
                                  className="group w-full flex items-center justify-between gap-3 text-left text-xs font-medium px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 cursor-pointer transition-colors"
                                >
                                  <span className="truncate leading-relaxed">🛺 {stop.name}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onStartNavigation(stop);
                                    }}
                                    className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-md transition-colors flex items-center justify-center shadow-sm"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Jeepney Routes & Stops — disabled for now (stop
                      coordinates aren't verified data yet); wrapped in
                      `false &&` rather than deleted so it's a one-line
                      flip to bring back. */}
                  {false && (
                  <div className="space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
                      Jeepney Routes &amp; Stops
                    </h3>
                    {mockRoutes.map((route) => {
                      const routeStops = places.filter(
                        (p) => p.type === "jeepney_stop" && p.routeId === route.id
                      );

                      return (
                        <div key={route.id} className="p-4 rounded-xl border bg-white border-gray-200 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-black/10"
                              style={{ backgroundColor: getJeepneyHexColor(route.colorCode) }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {route.routeCode}
                                </span>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate">
                                  {route.routeName}
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-400 mt-1 block">
                                Base fare ₱{route.baseFare.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            {routeStops.length === 0 ? (
                              <div className="text-xs text-gray-400 italic px-1 py-1">
                                No stops listed yet for this route.
                              </div>
                            ) : (
                              routeStops.map((stop) => (
                                <div
                                  key={stop.id}
                                  onClick={() => onSelectPlace(stop)}
                                  className="group w-full flex items-center justify-between gap-3 text-left text-xs font-medium px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 cursor-pointer transition-colors"
                                >
                                  <span className="truncate leading-relaxed">🚐 {stop.name}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onStartNavigation(stop);
                                    }}
                                    className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-md transition-colors flex items-center justify-center shadow-sm"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              ) : activeTab === "explore" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Nearby Spots ({places.length})
                    </h3>
                    {isLoadingAmenities && (
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-500">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Loading nearby places…
                      </span>
                    )}
                  </div>
                  {places.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      {isLoadingAmenities ? (
                        <span className="flex flex-col items-center gap-2">
                          <svg className="w-5 h-5 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                          Fetching nearby places — this can take a moment.
                        </span>
                      ) : (
                        "No matching places found. Try typing a query."
                      )}
                    </div>
                  ) : (
                    places.map((place) => (
                      <div
                        key={place.id}
                        onClick={() => onSelectPlace(place)}
                        className="group p-4 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-sm rounded-xl cursor-pointer transition-all duration-200"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-800 group-hover:text-gray-950 transition-colors">
                              {place.name}
                            </h4>
                            <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 mt-1 bg-gray-100 text-gray-500 rounded-md">
                              {place.type?.replace("_", " ")}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartNavigation(place);
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors flex items-center justify-center shadow-md shadow-blue-600/20"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
                    Interactive Route Index
                  </h3>
                  {mockRoutes.map((route) => {
                    const isFwdIsolated = isolatedDirectionId === `${route.id}-fwd`;
                    const isRevIsolated = isolatedDirectionId === `${route.id}-rev`;
                    const isRouteVisible = visibleRouteIds.includes(route.id);

                    return (
                      <div
                        key={route.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isRouteVisible
                            ? "bg-white border-gray-200 shadow-sm"
                            : "bg-gray-50 border-gray-100 opacity-60 hover:opacity-85"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getJeepneyHexColor(route.colorCode) }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                {route.routeCode}
                              </span>
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                                {route.colorCode}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          <button
                            onClick={() => onSelectRoute(route.id, `${route.id}-fwd`)}
                            className={`w-full text-left text-xs font-medium p-2 rounded-lg flex items-center justify-between transition-colors ${
                              isFwdIsolated
                                ? "bg-blue-600 text-white font-bold"
                                : "bg-gray-50 hover:bg-gray-100 text-gray-600"
                            }`}
                          >
                            <span className="truncate">➡️ {route.routeName}</span>
                            <span className="text-[10px] opacity-70 ml-2">Show</span>
                          </button>

                          <button
                            onClick={() => onSelectRoute(route.id, `${route.id}-rev`)}
                            className={`w-full text-left text-xs font-medium p-2 rounded-lg flex items-center justify-between transition-colors ${
                              isRevIsolated
                                ? "bg-blue-600 text-white font-bold"
                                : "bg-gray-50 hover:bg-gray-100 text-gray-600"
                            }`}
                          >
                            <span className="truncate">⬅️ {route.reversedName}</span>
                            <span className="text-[10px] opacity-70 ml-2">Show</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Directions Routing Card */
          <div className="flex-1 flex flex-col min-h-0 bg-white">

            {/* Header destinations */}
            <div className="p-4 border-b border-gray-200 flex items-start justify-between">
              <div className="min-w-0 pr-4">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
                  Directions
                </span>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-10 flex-shrink-0">From:</span>
                    <span className="font-semibold text-gray-800 truncate">
                      {origin?.name || "Select starting point..."}
                    </span>
                    <button
                      onClick={onSelectOriginMode}
                      className="flex-shrink-0 text-[10px] font-bold text-blue-600 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors whitespace-nowrap"
                      title="Choose starting point on the map"
                    >
                      {origin ? "Change" : "Choose on map"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-10 flex-shrink-0">To:</span>
                    <span className="font-semibold text-gray-800 truncate">
                      {destination?.name || "Unnamed"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onCloseRouting}
                className="p-1.5 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-900 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* =============================================
                ⚡ MULTI-MODAL COMPARISON METRICS CARD
               ============================================= */}
            <RouteSummaryCard
              mode={mode}
              summary={summary}
              // Tricycle routing is synchronous: once it has run with nothing to
              // show, the card says why instead of spinning forever.
              loading={routeInstructions.length === 0 && !(mode === "tricycle" && martinsRoutes.length === 0)}
              emptyText={
                mode === "tricycle"
                  ? tricycleWalkOnly
                    ? "No tricycle stop within reach — walking is faster"
                    : "No tricycle zone covers this trip"
                  : "No route for this mode"
              }
              notice={
                mode === "tricycle" && tricycleWalkOnly && martinsRoutes.length > 0 && tricycleWalkMinutes !== null
                  ? `Short trip — walking takes about ${tricycleWalkMinutes} min, so the tricycle mainly saves you the walk.`
                  : undefined
              }
            />

            {/* Sub-mode selections (tab strip) — grid, not flex+min-width,
                so all tabs always fit the sidebar's width instead of
                overflowing and getting cut off at the edge. A destination
                can opt out of specific modes (e.g. a tricycle boarding spot
                excludes Tricycle — routing a trike trip to its own stand
                isn't a meaningful option) via destination.excludeModes. */}
            {(() => {
              const excludedModes: TravelMode[] = destination?.excludeModes ?? [];
              const availableModes = (["driving", "walking", "cycling", "transit", "tricycle"] as TravelMode[]).filter(
                (m) => !excludedModes.includes(m)
              );
              return (
                <div
                  className="p-3 border-b border-gray-200 bg-white grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${availableModes.length}, minmax(0, 1fr))` }}
                >
                  {availableModes.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`py-2 px-0.5 text-[10px] leading-tight font-bold rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                        mode === m
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                          : "bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      <span className="capitalize text-center">{m === "cycling" ? "motor" : m}</span>
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* =============================================
                ⚡ JEEPNEY TRANSIT ALTERNATIVES SELECTOR
               ============================================= */}
            {mode === "transit" && transitCandidates.length > 1 && (
              <div className="p-3 bg-gray-50/60 border-b border-gray-200">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2.5">
                  Alternative Jeepney Transfers
                </span>
                <div className="space-y-1.5">
                  {transitCandidates.map((candidate, index) => {
                    const isSelected = index === activeTransitIdx;
                    const candidateFare = candidate.transfer
                      ? candidate.jeepney.baseFare + candidate.transfer.jeepney.baseFare
                      : candidate.jeepney.baseFare;

                    return (
                      <button
                        key={index}
                        onClick={() => setActiveTransitIdx && setActiveTransitIdx(index)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-blue-50 border-blue-400 text-blue-700 font-bold"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          {candidate.jeepney.routeCode}
                          {candidate.transfer && ` ➔ ${candidate.transfer.jeepney.routeCode}`}
                        </span>
                        <span>
                          ₱{candidateFare.toFixed(2)} • {candidate.transfer ? "1 Transfer" : "Direct"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =============================================
                ⚡ GENERAL ALTERNATIVE ROUTE SELECTOR (Driving, Walking, Motor)
               ============================================= */}
            {mode !== "transit" && alternativeRoutes.length > 1 && (
              <div className="p-3 bg-gray-50/60 border-b border-gray-200">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2.5">
                  Alternate Routes Available
                </span>
                <div className="space-y-1.5">
                  {alternativeRoutes.map((route, index) => {
                    const duration = Math.round(route.duration / 60);
                    const distance = (route.distance / 1000).toFixed(1);
                    const isSelected = index === activeRouteIdx;

                    return (
                      <button
                        key={index}
                        onClick={() => setActiveRouteIdx && setActiveRouteIdx(index)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-blue-50 border-blue-400 text-blue-700 font-bold"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span>
                          Route {index + 1} ({route.summary || "Main Path"})
                        </span>
                        <span>
                          ~{duration} mins • {distance} km
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =============================================
                🧭 TRICYCLE: MARTINS PARETO ROUTE SELECTOR
               ============================================= */}
            {mode === "tricycle" && martinsRoutes.length > 0 && (
              <div className="p-3 bg-violet-50/60 border-b border-gray-200">
                <span className="text-[10px] font-black text-violet-400 uppercase tracking-wider block mb-2.5">
                  Tricycle Options
                </span>
                <div className="space-y-1.5">
                  {martinsRoutes.map((route, index) => {
                    const isSelected = index === activeMartinsIdx;
                    const boardCount = route.legs.filter((leg: any) => leg.transition === "board-trike").length;
                    // Same Direct/Transfer framing as Transit mode — never
                    // "Cheapest"/"Balanced", those aren't shown here anymore.
                    const label = boardCount >= 2 ? "Transfer" : "Direct";

                    return (
                      <button
                        key={index}
                        onClick={() => setActiveMartinsIdx && setActiveMartinsIdx(index)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-violet-50 border-violet-400 text-violet-700 font-bold"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span>{label}</span>
                        <span>
                          ~{route.cost[0].toFixed(1)} min • ₱{route.cost[1].toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Turn-by-Turn Instruction List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
              {routeInstructions.length === 0 ? (
                mode === "tricycle" && martinsRoutes.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    {tricycleWalkOnly
                      ? "🚶 No tricycle stop is within reach for this trip — walking is your best option."
                      : "🛺 No tricycle zone covers this trip yet."}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 text-sm animate-pulse">
                    Mapping the best route...
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                    Step-by-step Navigation
                  </h3>

                  <div className="relative border-l-2 border-gray-200 pl-5 ml-2.5 space-y-5">
                    {routeInstructions.map((step, idx) => {
                      const isBoard = step.maneuver.instruction.includes("BOARD:");
                      const isAlight = step.maneuver.instruction.includes("ALIGHT:");
                      const isTransfer = step.maneuver.instruction.includes("TRANSFER");

                      return (
                        <div key={idx} className="relative group">
                          <div
                            className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow transition-transform duration-200 group-hover:scale-125 ${
                              isBoard
                                ? "bg-yellow-500"
                                : isAlight
                                ? "bg-red-500"
                                : isTransfer
                                ? "bg-orange-500"
                                : "bg-gray-300"
                            }`}
                          />

                          <div className="bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-sm p-3 rounded-xl transition-all">
                            <p className="text-sm font-medium text-gray-800">
                              {step.maneuver.instruction}
                            </p>

                            {isBoard && (
                              <div className="mt-2.5 flex items-center justify-between text-xs font-bold text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                <span>Fare: {estimateFare(step.maneuver.instruction) || "₱13.00"}</span>
                                <span className="px-2 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200">
                                  Boarding
                                </span>
                              </div>
                            )}

                            {isTransfer && (
                              <div className="mt-2.5 flex items-center justify-between text-xs font-bold text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                <span className="text-orange-600">Add'l Fare: {estimateFare(step.maneuver.instruction) || "₱13.00"}</span>
                                <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                                  Transfer
                                </span>
                              </div>
                            )}

                            {step.distance > 0 && (
                              <span className="inline-block mt-2 text-[11px] font-black text-gray-400">
                                {step.distance >= 1000
                                  ? `${(step.distance / 1000).toFixed(2)} km`
                                  : `${Math.round(step.distance)} m`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Fare Summary at the bottom */}
            {mode === "transit" && routeInstructions.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-emerald-50/60 flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    Est. Total Fare
                  </span>
                  <span className="text-xl font-black text-emerald-600">
                    ₱{transitFareSum.toFixed(2)}
                  </span>
                </div>
                <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 shadow-sm flex-shrink-0">
                  Ref: {activeTransitPlan?.transfer ? "1 Transfer" : "Direct Ride"}
                </div>
              </div>
            )}

            {mode === "tricycle" && routeInstructions.length > 0 && activeMartinsRoute && isLongTricycleTrip && (
              <div className="px-3 py-2.5 border-t border-amber-200 bg-amber-50 text-xs text-amber-800 leading-snug">
                <span className="font-bold">⛽ Long tricycle ride (~{tricycleRideKm.toFixed(1)} km).</span>{" "}
                With fuel prices up, drivers may ask for more than the ₱{tricycleFareSum.toFixed(2)} estimate on
                longer trips. Agree on the fare with the driver before boarding.
              </div>
            )}

            {mode === "tricycle" && routeInstructions.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-emerald-50/60 flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    Est. Total Fare
                  </span>
                  <span className="text-xl font-black text-emerald-600">
                    {activeMartinsRoute ? `₱${tricycleFareSum.toFixed(2)}` : "Not available"}
                  </span>
                </div>
                {activeMartinsRoute && (
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 shadow-sm flex-shrink-0">
                    Ref: {tricycleBoardCount >= 2 ? "1 Transfer" : tricycleCrossesZone ? "Crosses Zone" : "Within Zone"}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}
