"use client";

// Desktop sidebar (laptop width and up). Phones and tablets use the bottom
// sheet in mobile/MobileSheet.tsx instead, built from the same panels.

import { useState } from "react";
import DirectionsPanel from "./panels/directions/DirectionsPanel";
import JeepneyRouteIndex from "./panels/explore/JeepneyRouteIndex";
import PlacesList from "./panels/explore/PlacesList";
import StopsList from "./panels/explore/StopsList";
import type { PanelProps } from "./panels/types";

type Tab = "explore" | "routes" | "stops";

const TABS: { id: Tab; label: string; active: string }[] = [
  { id: "explore", label: "Explore Places", active: "border-blue-600 text-blue-600" },
  { id: "routes", label: "Jeepney Routes", active: "border-violet-600 text-violet-600" },
  { id: "stops", label: "Stops", active: "border-emerald-600 text-emerald-600" },
];

function AppHeader() {
  return (
    <div className="p-6 border-b border-gray-200 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 via-violet-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
          OlongaPunta
        </h1>
        <p className="text-xs text-gray-400 font-semibold tracking-widest uppercase mt-0.5">Transit & Explore</p>
      </div>
      <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600 border border-gray-200">Olongapo City</div>
    </div>
  );
}

export default function Sidebar(props: PanelProps) {
  const [tab, setTab] = useState<Tab>("explore");

  return (
    <aside className="hidden lg:flex relative z-20 h-full w-full max-w-sm flex-col bg-white text-gray-900 border-r border-gray-200 shadow-lg">
      {props.isRoutingMode ? (
        <DirectionsPanel {...props} className="flex-1" />
      ) : (
        <>
          <AppHeader />
          <div className="flex border-b border-gray-200 bg-gray-50/60">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-4 text-sm font-bold tracking-wide transition-all border-b-2 ${
                  tab === t.id ? `${t.active} bg-white` : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
            {tab === "explore" && (
              <PlacesList
                places={props.places}
                isLoading={props.isLoadingAmenities}
                onSelectPlace={props.onSelectPlace}
                onStartNavigation={props.onStartNavigation}
              />
            )}
            {tab === "routes" && (
              <JeepneyRouteIndex visibleRouteIds={props.visibleRouteIds} isolatedDirectionId={props.isolatedDirectionId} onSelectRoute={props.onSelectRoute} />
            )}
            {tab === "stops" && <StopsList places={props.places} onSelectPlace={props.onSelectPlace} onStartNavigation={props.onStartNavigation} />}
          </div>
        </>
      )}
    </aside>
  );
}
