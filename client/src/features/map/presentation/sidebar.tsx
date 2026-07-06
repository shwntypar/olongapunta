"use client";

import React, { useState } from "react";
import { mockRoutes } from "../domain/MockData";

export type TravelMode = "driving" | "walking" | "cycling" | "transit";

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

  // 🚗 Alternative Paths Props (Driving, Walking, Motor)
  alternativeRoutes?: any[];
  activeRouteIdx?: number;
  setActiveRouteIdx?: (idx: number) => void;

  // 🚐 Transit Candidate Props (Alternatives)
  transitCandidates?: any[];
  activeTransitIdx?: number;
  setActiveTransitIdx?: (idx: number) => void;
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

  // Alternative paths (Walking, Motor, Driving)
  alternativeRoutes = [],
  activeRouteIdx = 0,
  setActiveRouteIdx,

  // Transit options list
  transitCandidates = [],
  activeTransitIdx = 0,
  setActiveTransitIdx,
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

  // Estimate Fare for Jeepney instructions
  const estimateFare = (instructionText: string) => {
    const match = instructionText.match(/Ride the (J-\d+)/);
    if (!match) return null;
    const code = match[1];
    const route = mockRoutes.find((r) => r.routeCode === code || r.routeName.includes(code));
    if (route) {
      return `₱${route.baseFare.toFixed(2)}`;
    }
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

  return (
    <div className="absolute top-0 left-0 w-96 h-full bg-slate-900/95 backdrop-blur-md text-white border-r border-slate-800 flex flex-col z-20 shadow-2xl transition-all duration-300">
      
      {/* App Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
            OlongaPunta
          </h1>
          <p className="text-xs text-slate-400 font-semibold tracking-widest uppercase mt-0.5">
            Transit & Explore
          </p>
        </div>
        <div className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-300 border border-slate-700">
          Olongapo City
        </div>
      </div>

      {!isRoutingMode ? (
        <>
          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/40">
            <button
              onClick={() => setActiveTab("explore")}
              className={`flex-1 py-4 text-sm font-bold tracking-wide transition-all border-b-2 ${
                activeTab === "explore"
                  ? "border-blue-500 text-blue-400 bg-slate-800/20"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              📍 Explore Places
            </button>
            <button
              onClick={() => setActiveTab("routes")}
              className={`flex-1 py-4 text-sm font-bold tracking-wide transition-all border-b-2 ${
                activeTab === "routes"
                  ? "border-purple-500 text-purple-400 bg-slate-800/20"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              🚐 Jeepney Routes
            </button>
          </div>

          {/* Scrollable explore list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
            {activeTab === "explore" ? (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                  Nearby Spots ({places.length})
                </h3>
                {places.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No matching places found. Try typing a query.
                  </div>
                ) : (
                  places.map((place) => (
                    <div
                      key={place.id}
                      onClick={() => onSelectPlace(place)}
                      className="group p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 rounded-xl cursor-pointer transition-all duration-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                            {place.name}
                          </h4>
                          <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 mt-1 bg-slate-700/60 text-slate-300 rounded-md">
                            {place.type?.replace("_", " ")}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartNavigation(place);
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors flex items-center justify-center shadow-md shadow-blue-900/30"
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
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
                          ? "bg-slate-800/40 border-slate-700/60"
                          : "bg-slate-950/20 border-slate-900 opacity-60 hover:opacity-85"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getJeepneyHexColor(route.colorCode) }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                              {route.routeCode}
                            </span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
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
                              ? "bg-blue-600/90 text-white font-bold"
                              : "bg-slate-800/70 hover:bg-slate-700 text-slate-300"
                          }`}
                        >
                          <span className="truncate">➡️ {route.routeName}</span>
                          <span className="text-[10px] opacity-70 ml-2">Show</span>
                        </button>

                        <button
                          onClick={() => onSelectRoute(route.id, `${route.id}-rev`)}
                          className={`w-full text-left text-xs font-medium p-2 rounded-lg flex items-center justify-between transition-colors ${
                            isRevIsolated
                              ? "bg-blue-600/90 text-white font-bold"
                              : "bg-slate-800/70 hover:bg-slate-700 text-slate-300"
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
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950/30">
          
          {/* Header destinations */}
          <div className="p-5 border-b border-slate-800 flex items-start justify-between">
            <div className="min-w-0 pr-4">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-blue-400 bg-blue-900/30 border border-blue-800/50 px-2.5 py-0.5 rounded-full">
                Directions
              </span>
              <div className="mt-2.5 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-12 flex-shrink-0">From:</span>
                  <span className="font-semibold text-slate-200 truncate">
                    {origin?.name || "Select starting point..."}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-12 flex-shrink-0">To:</span>
                  <span className="font-semibold text-slate-200 truncate">
                    {destination?.name || "Unnamed"}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onCloseRouting}
              className="p-1.5 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* =============================================
              ⚡ MULTI-MODAL COMPARISON METRICS CARD
             ============================================= */}
          <div className="p-4 bg-slate-900/80 border-b border-slate-800 grid grid-cols-2 gap-2">
            
            {/* Transit summary card */}
            <div
              onClick={() => setMode("transit")}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                mode === "transit"
                  ? "bg-slate-800 border-blue-500 shadow-md"
                  : "bg-slate-950/40 border-slate-850 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-400">
                <span>🚐</span> Transit
              </div>
              {transitCandidates.length > 0 ? (
                <div className="mt-1.5">
                  <span className="text-lg font-black block text-slate-100 leading-none">
                    {transitCandidates[activeTransitIdx] ? `${Math.round(transitCandidates[activeTransitIdx].score * 4)}m` : "Calculating..."}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-extrabold mt-1 block">
                    ₱{transitFareSum.toFixed(2)} • {activeTransitPlan?.transfer ? "1 Transfer" : "Direct"}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-500 mt-2 block italic">Not available</span>
              )}
            </div>

            {/* Driving summary card */}
            <div
              onClick={() => setMode("driving")}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                mode === "driving"
                  ? "bg-slate-800 border-blue-500 shadow-md"
                  : "bg-slate-950/40 border-slate-850 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-400">
                <span>🚗</span> Driving
              </div>
              {activeDriveInfo ? (
                <div className="mt-1.5">
                  <span className="text-lg font-black block text-slate-100 leading-none">
                    {activeDriveInfo.durationMin}m
                  </span>
                  <span className="text-[10px] text-blue-400 font-extrabold mt-1 block truncate">
                    {activeDriveInfo.distanceKm} km • {activeDriveInfo.summary.substring(0, 10)}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-500 mt-2 block italic">Not available</span>
              )}
            </div>

          </div>

          {/* Sub-mode selections (tab strip) */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/30 flex gap-1.5">
            {(["driving", "walking", "cycling", "transit"] as TravelMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                  mode === m
                    ? "bg-blue-600 text-white border-blue-500 shadow-md"
                    : "bg-slate-800/50 text-slate-400 border-slate-850 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span className="text-lg">
                  {m === "driving" && "🚗"}
                  {m === "walking" && "🚶"}
                  {m === "cycling" && "🏍️"}
                  {m === "transit" && "🚐"}
                </span>
                <span className="capitalize">{m === "cycling" ? "motor" : m}</span>
              </button>
            ))}
          </div>

          {/* =============================================
              ⚡ JEEPNEY TRANSIT ALTERNATIVES SELECTOR
             ============================================= */}
          {mode === "transit" && transitCandidates.length > 1 && (
            <div className="p-4 bg-slate-900/50 border-b border-slate-850">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
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
                          ? "bg-blue-600/20 border-blue-500 text-blue-300 font-bold"
                          : "bg-slate-950/30 border-slate-850 text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      <span className="truncate flex items-center gap-1">
                        <span>🚐</span> {candidate.jeepney.routeCode}
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
            <div className="p-4 bg-slate-900/50 border-b border-slate-850">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">
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
                          ? "bg-blue-600/20 border-blue-500 text-blue-300 font-bold"
                          : "bg-slate-950/30 border-slate-850 text-slate-300 hover:bg-slate-900"
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

          {/* Turn-by-Turn Instruction List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
            {routeInstructions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm animate-pulse">
                🔄 Mapping the best route...
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Step-by-step Navigation
                </h3>

                <div className="relative border-l-2 border-slate-800 pl-5 ml-2.5 space-y-5">
                  {routeInstructions.map((step, idx) => {
                    const isBoard = step.maneuver.instruction.includes("BOARD:");
                    const isAlight = step.maneuver.instruction.includes("ALIGHT:");
                    const isTransfer = step.maneuver.instruction.includes("TRANSFER —");

                    return (
                      <div key={idx} className="relative group">
                        <div
                          className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full border-2 transition-transform duration-200 group-hover:scale-125 ${
                            isBoard
                              ? "bg-yellow-500 border-slate-950"
                              : isAlight
                              ? "bg-red-500 border-slate-950"
                              : isTransfer
                              ? "bg-orange-500 border-slate-950"
                              : "bg-slate-700 border-slate-950"
                          }`}
                        />

                        <div className="bg-slate-900/60 hover:bg-slate-800/80 border border-slate-900/80 hover:border-slate-800 p-3 rounded-xl transition-all">
                          <p className="text-sm font-medium text-slate-200">
                            {step.maneuver.instruction}
                          </p>

                          {isBoard && (
                            <div className="mt-2.5 flex items-center justify-between text-xs font-bold text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                              <span>💳 Fare: {estimateFare(step.maneuver.instruction) || "₱13.00"}</span>
                              <span className="px-2 py-0.5 rounded bg-yellow-950/60 text-yellow-500 border border-yellow-800/40">
                                Boarding
                              </span>
                            </div>
                          )}

                          {isTransfer && (
                            <div className="mt-2.5 flex items-center justify-between text-xs font-bold text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                              <span className="text-orange-400">💳 Add'l Fare: {estimateFare(step.maneuver.instruction) || "₱13.00"}</span>
                              <span className="px-2 py-0.5 rounded bg-orange-950/60 text-orange-500 border border-orange-800/40">
                                🔄 Transfer
                              </span>
                            </div>
                          )}

                          {step.distance > 0 && (
                            <span className="inline-block mt-2 text-[11px] font-black text-slate-500">
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
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Est. Total Fare
                </span>
                <span className="text-xl font-black text-emerald-400">
                  ₱{transitFareSum.toFixed(2)}
                </span>
              </div>
              <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-300">
                Ref: {activeTransitPlan?.transfer ? "1 Transfer" : "Direct Ride"}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}