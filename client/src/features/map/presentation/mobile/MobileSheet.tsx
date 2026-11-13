"use client";

// Phones and tablets: one bottom sheet instead of the sidebar. Browsing shows
// Nearby / Routes / Stops tabs; while routing it shows the directions panel.

import { useState } from "react";
import type { Place } from "../../domain/types";
import DirectionsPanel from "../panels/directions/DirectionsPanel";
import JeepneyRouteIndex from "../panels/explore/JeepneyRouteIndex";
import StopsList from "../panels/explore/StopsList";
import type { PanelProps } from "../panels/types";
import BottomSheet from "./BottomSheet";
import type { SheetSnap } from "./sheetLayout";
import NearbyPlaces from "./NearbyPlaces";

type Tab = "nearby" | "routes" | "stops";
const TABS: { id: Tab; label: string }[] = [
  { id: "nearby", label: "Nearby" },
  { id: "routes", label: "Jeepney Routes" },
  { id: "stops", label: "Stops" },
];

/** What the page is doing; the sheet picks a height whenever this changes. */
type Phase = "browsing" | "picking-origin" | "routing";
const SNAP_FOR_PHASE: Record<Phase, SheetSnap> = {
  browsing: "peek",
  "picking-origin": "peek", // keep the map clear so the start point can be tapped
  routing: "half",
};

export default function MobileSheet(props: PanelProps) {
  const [tab, setTab] = useState<Tab>("nearby");
  const phase: Phase = !props.isRoutingMode ? "browsing" : props.isPickingOrigin ? "picking-origin" : "routing";
  const [snap, setSnap] = useState<SheetSnap>(SNAP_FOR_PHASE[phase]);

  // Re-snap when the phase changes (adjusting state during render, not in an effect).
  const [lastPhase, setLastPhase] = useState(phase);
  if (phase !== lastPhase) {
    setLastPhase(phase);
    setSnap(SNAP_FOR_PHASE[phase]);
  }

  /** Picking a place from the list: shrink the sheet so the map shows it. */
  const selectPlace = (place: Place) => {
    props.onSelectPlace(place);
    setSnap("peek");
  };
  const openUp = () => snap === "peek" && setSnap("half");

  return (
    <BottomSheet snap={snap} onSnapChange={setSnap}>
      {props.isRoutingMode ? (
        <DirectionsPanel {...props} className="flex-1 rounded-t-2xl" />
      ) : (
        <>
          <div className="flex-shrink-0 flex px-3 pb-2 gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  openUp();
                }}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${
                  tab === t.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "nearby" ? (
            <NearbyPlaces
              places={props.places}
              searchQuery={props.searchQuery}
              isLoading={props.isLoadingAmenities}
              onSelectPlace={selectPlace}
              onStartNavigation={props.onStartNavigation}
              onPickCategory={openUp}
            />
          ) : (
            <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin scrollbar-thumb-gray-300">
              {tab === "routes" ? (
                <JeepneyRouteIndex
                  visibleRouteIds={props.visibleRouteIds}
                  isolatedDirectionId={props.isolatedDirectionId}
                  onSelectRoute={(routeId, directionId) => {
                    props.onSelectRoute(routeId, directionId);
                    setSnap("peek");
                  }}
                />
              ) : (
                <StopsList places={props.places} onSelectPlace={selectPlace} onStartNavigation={props.onStartNavigation} />
              )}
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}
