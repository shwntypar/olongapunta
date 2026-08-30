"use client";

import React, { useState } from "react";
import { mockRoutes } from "../domain/MockData";
import { tricycleZones } from "../domain/TricycleZoneData";

export type TravelMode = "driving" | "walking" | "cycling" | "transit" | "tricycle";

interface SidebarProps {
  places: any[];
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

  // 🛺 Tricycle Zone Candidate Props (Alternatives)
  tricycleCandidates?: any[];
  activeTricycleIdx?: number;
  setActiveTricycleIdx?: (idx: number) => void;
}

export default function Sidebar({
  places,
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

  // Tricycle zone candidates list
  tricycleCandidates = [],
  activeTricycleIdx = 0,
  setActiveTricycleIdx,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"explore" | "routes">("explore");

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

  // Extract fare/transfer info from the active tricycle zone candidate
  const activeTricyclePlan = tricycleCandidates[activeTricycleIdx];
  const tricycleFareSum = activeTricyclePlan
    ? activeTricyclePlan.legs.reduce((sum: number, leg: any) => sum + leg.zone.baseFare, 0)
    : 0;
  const tricycleIsTransfer = activeTricyclePlan ? activeTricyclePlan.legs.length > 1 : false;

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
        {/* App Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 via-violet-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
              OlongaPunta
            </h1>
            <p className="text-xs text-gray-400 font-semibold tracking-widest uppercase mt-0.5">
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

        {!isRoutingMode ? (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/60">
              <button
                onClick={() => setActiveTab("explore")}
                className={`flex-1 py-4 text-sm font-bold tracking-wide transition-all border-b-2 ${
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
            </div>

            {/* Scrollable explore list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
              {activeTab === "explore" ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
                    Nearby Spots ({places.length})
                  </h3>
                  {places.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No matching places found. Try typing a query.
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
            <div className="p-5 border-b border-gray-200 flex items-start justify-between">
              <div className="min-w-0 pr-4">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
                  Directions
                </span>
                <div className="mt-2.5 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-12 flex-shrink-0">From:</span>
                    <span className="font-semibold text-gray-800 truncate">
                      {origin?.name || "Select starting point..."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-12 flex-shrink-0">To:</span>
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
            <div className="p-4 bg-gray-50/70 border-b border-gray-200 grid grid-cols-2 gap-2">

              {/* Transit summary card */}
              <div
                onClick={() => setMode("transit")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  mode === "transit"
                    ? "bg-white border-blue-500 shadow-md"
                    : "bg-white/60 border-gray-200 hover:bg-white hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-gray-400">
                   Transit
                </div>
                {transitCandidates.length > 0 ? (
                  <div className="mt-1.5">
                    <span className="text-lg font-black block text-gray-900 leading-none">
                      {transitCandidates[activeTransitIdx] ? `${Math.round(transitCandidates[activeTransitIdx].score * 4)}m` : "Calculating..."}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-extrabold mt-1 block">
                      ₱{transitFareSum.toFixed(2)} • {activeTransitPlan?.transfer ? "1 Transfer" : "Direct"}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400 mt-2 block italic">Not available</span>
                )}
              </div>

              {/* Driving summary card */}
              <div
                onClick={() => setMode("driving")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  mode === "driving"
                    ? "bg-white border-blue-500 shadow-md"
                    : "bg-white/60 border-gray-200 hover:bg-white hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-gray-400">
                   Driving
                </div>
                {activeDriveInfo ? (
                  <div className="mt-1.5">
                    <span className="text-lg font-black block text-gray-900 leading-none">
                      {activeDriveInfo.durationMin}m
                    </span>
                    <span className="text-[10px] text-blue-600 font-extrabold mt-1 block truncate">
                      {activeDriveInfo.distanceKm} km • {activeDriveInfo.summary.substring(0, 10)}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400 mt-2 block italic">Not available</span>
                )}
              </div>

            </div>

            {/* Sub-mode selections (tab strip) */}
            <div className="p-3 border-b border-gray-200 bg-white flex gap-1.5 overflow-x-auto scrollbar-hide">
              {(["driving", "walking", "cycling", "transit", "tricycle"] as TravelMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 min-w-[4.5rem] py-2 text-xs font-bold rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                    mode === m
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <span className="capitalize">{m === "cycling" ? "motor" : m}</span>
                </button>
              ))}
            </div>

            {/* =============================================
                ⚡ JEEPNEY TRANSIT ALTERNATIVES SELECTOR
               ============================================= */}
            {mode === "transit" && transitCandidates.length > 1 && (
              <div className="p-4 bg-gray-50/60 border-b border-gray-200">
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
              <div className="p-4 bg-gray-50/60 border-b border-gray-200">
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
                          {duration} mins • {distance} km
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =============================================
                ⚡ TRICYCLE ZONE ALTERNATIVES SELECTOR
               ============================================= */}
            {mode === "tricycle" && tricycleCandidates.length > 1 && (
              <div className="p-4 bg-gray-50/60 border-b border-gray-200">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2.5">
                  Alternative Tricycle Options
                </span>
                <div className="space-y-1.5">
                  {tricycleCandidates.map((candidate, index) => {
                    const isSelected = index === activeTricycleIdx;
                    const candidateFare = candidate.legs.reduce((sum: number, leg: any) => sum + leg.zone.baseFare, 0);

                    return (
                      <button
                        key={index}
                        onClick={() => setActiveTricycleIdx && setActiveTricycleIdx(index)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-blue-50 border-blue-400 text-blue-700 font-bold"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          {candidate.legs[0].zone.code}
                          {candidate.legs.length === 2 && ` ➔ ${candidate.legs[1].zone.code}`}
                        </span>
                        <span>
                          ₱{candidateFare.toFixed(2)} • {candidate.legs.length === 2 ? "1 Transfer" : "Direct"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Turn-by-Turn Instruction List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
              {routeInstructions.length === 0 ? (
                mode === "tricycle" && tricycleCandidates.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    🛺 No tricycle zone covers this trip yet.
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
              <div className="p-4 border-t border-gray-200 bg-emerald-50/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    Est. Total Fare
                  </span>
                  <span className="text-xl font-black text-emerald-600">
                    ₱{transitFareSum.toFixed(2)}
                  </span>
                </div>
                <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 shadow-sm">
                  Ref: {activeTransitPlan?.transfer ? "1 Transfer" : "Direct Ride"}
                </div>
              </div>
            )}

            {mode === "tricycle" && routeInstructions.length > 0 && (
              <div className="p-4 border-t border-gray-200 bg-emerald-50/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                    Est. Total Fare
                  </span>
                  <span className="text-xl font-black text-emerald-600">
                    {activeTricyclePlan ? `₱${tricycleFareSum.toFixed(2)}` : "Not available"}
                  </span>
                </div>
                {activeTricyclePlan && (
                  <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 shadow-sm">
                    Ref: {tricycleIsTransfer ? "1 Transfer" : "Direct Ride"}
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
