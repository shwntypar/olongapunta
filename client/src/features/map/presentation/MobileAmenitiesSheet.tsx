"use client";

import React, { useRef, useState } from "react";

interface Place {
  id: number | string;
  name: string;
  type: string;
  lat: number;
  lon: number;
}

interface MobileAmenitiesSheetProps {
  places: Place[];
  searchQuery: string;
  onSelectPlace: (place: Place) => void;
  onStartNavigation: (place: Place) => void;
  hidden?: boolean;
}

type SheetState = "peek" | "half" | "full";

const PEEK_HEIGHT = 128;

const CATEGORY_ICON_PATHS: Record<string, string> = {
  hospital: "M12 6v12 M6 12h12",
  clinic: "M12 6v12 M6 12h12",
  pharmacy: "M12 6v12 M6 12h12",
  dentist: "M12 6v12 M6 12h12",
  police: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  school: "M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c0 2 2 3 6 3s6-1 6-3v-5",
  university: "M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c0 2 2 3 6 3s6-1 6-3v-5",
  bank: "M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M11 10v11 M15 10v11 M20 10v11",
  atm: "M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M11 10v11 M15 10v11 M20 10v11",
  supermarket: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  convenience: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  restaurant: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2H3zm10 0v20h2V2h-2z",
  fast_food: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2H3zm10 0v20h2V2h-2z",
  cafe: "M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M10 1v3 M14 1v3",
  fuel: "M3 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18 M3 22h10 M15 8h2a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 3 0V8l-3-3",
  place_of_worship: "M12 2l4 8h-8z M8 22V10h8v12",
  post_office: "M3 8l9 6 9-6 M3 6h18v12H3z",
};

const FALLBACK_ICON_PATH = "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";

function getCategoryColor(type: string) {
  const t = (type || "").toLowerCase();
  if (["hospital", "clinic", "pharmacy", "dentist"].includes(t)) return "#ef4444";
  if (["school", "university", "college"].includes(t)) return "#3b82f6";
  if (["bank", "atm"].includes(t)) return "#10b981";
  if (["supermarket", "convenience", "mall", "marketplace", "restaurant", "cafe", "fast_food"].includes(t)) return "#f59e0b";
  if (["townhall", "police", "fire_station", "post_office"].includes(t)) return "#8b5cf6";
  return "#64748b";
}

function formatAmenityLabel(type: string) {
  if (!type) return "Place";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function CategoryIcon({ type, color }: { type: string; color: string }) {
  const path = CATEGORY_ICON_PATHS[(type || "").toLowerCase()] || FALLBACK_ICON_PATH;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export default function MobileAmenitiesSheet({
  places,
  searchQuery,
  onSelectPlace,
  onStartNavigation,
  hidden = false,
}: MobileAmenitiesSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>("peek");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const activeHandlersRef = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null);

  const getSnapHeight = (state: SheetState) => {
    if (typeof window === "undefined") return PEEK_HEIGHT;
    const vh = window.innerHeight;
    if (state === "peek") return PEEK_HEIGHT;
    if (state === "half") return Math.round(vh * 0.48);
    return Math.round(vh * 0.88);
  };

  const clampHeight = (h: number) => {
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    return Math.min(Math.max(h, PEEK_HEIGHT - 24), vh * 0.9);
  };

  const cleanupDragListeners = () => {
    if (activeHandlersRef.current) {
      window.removeEventListener("pointermove", activeHandlersRef.current.move);
      window.removeEventListener("pointerup", activeHandlersRef.current.up);
      activeHandlersRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const startHeight = getSnapHeight(sheetState);

    const onMove = (ev: PointerEvent) => {
      const delta = startY - ev.clientY;
      setDragHeight(clampHeight(startHeight + delta));
    };

    const onUp = () => {
      cleanupDragListeners();
      setDragHeight((current) => {
        if (current == null) return null;
        const vh = window.innerHeight;
        const candidates: [number, SheetState][] = [
          [PEEK_HEIGHT, "peek"],
          [vh * 0.48, "half"],
          [vh * 0.88, "full"],
        ];
        candidates.sort((a, b) => Math.abs(a[0] - current) - Math.abs(b[0] - current));
        setSheetState(candidates[0][1]);
        return null;
      });
    };

    cleanupDragListeners();
    activeHandlersRef.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  React.useEffect(() => cleanupDragListeners, []);

  if (hidden) return null;

  const categoryCounts: Record<string, number> = {};
  places.forEach((p) => {
    const t = (p.type || "other").toLowerCase();
    categoryCounts[t] = (categoryCounts[t] || 0) + 1;
  });
  const categories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type]) => type);

  const visiblePlaces = selectedCategory
    ? places.filter((p) => (p.type || "other").toLowerCase() === selectedCategory)
    : places;

  const height = dragHeight ?? getSnapHeight(sheetState);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 lg:hidden flex flex-col bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.18)]"
      style={{
        height,
        transition: dragHeight == null ? "height 280ms cubic-bezier(0.32,0.72,0,1)" : "none",
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onClick={() =>
          setSheetState((s) => (s === "peek" ? "half" : s === "half" ? "full" : "peek"))
        }
        className="flex-shrink-0 flex flex-col items-center pt-2.5 pb-2 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        <div className="w-10 h-1.5 rounded-full bg-gray-300" />
      </div>

      <div className="flex-shrink-0 px-3 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
            selectedCategory === null
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-700 border-gray-300"
          }`}
        >
          All ({places.length})
        </button>
        {categories.map((type) => {
          const isActive = selectedCategory === type;
          const color = getCategoryColor(type);
          return (
            <button
              key={type}
              onClick={() => {
                setSelectedCategory(isActive ? null : type);
                if (sheetState === "peek") setSheetState("half");
              }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                isActive ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"
              }`}
              style={isActive ? { backgroundColor: color } : undefined}
            >
              <CategoryIcon type={type} color={isActive ? "white" : color} />
              {formatAmenityLabel(type)} ({categoryCounts[type]})
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-300">
        {visiblePlaces.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {searchQuery ? `No matches for "${searchQuery}".` : "No places found nearby."}
          </div>
        ) : (
          visiblePlaces.map((place) => (
            <div
              key={place.id}
              onClick={() => onSelectPlace(place)}
              className="p-3.5 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200 rounded-xl flex items-center gap-3 cursor-pointer transition-colors"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: getCategoryColor(place.type) }}
              >
                <CategoryIcon type={place.type} color="white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-gray-800 truncate">{place.name}</h4>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                  {formatAmenityLabel(place.type)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartNavigation(place);
                }}
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white p-2 rounded-full shadow-md shadow-blue-600/20"
                title="Get directions"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
