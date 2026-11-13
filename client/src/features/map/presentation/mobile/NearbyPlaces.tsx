// Phone/tablet "Nearby" tab: category chips (the eight most common types) over the matching places.

import { useState } from "react";
import type { Place } from "../../domain/types";
import NavigateButton from "../panels/NavigateButton";
import { categoryColor, categoryIconPath, categoryLabel } from "../placeCategories";

const MAX_CHIPS = 8;

function CategoryIcon({ type, color }: { type: string; color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={categoryIconPath(type)} />
    </svg>
  );
}

const typeOf = (p: Place) => (p.type || "other").toLowerCase();

export default function NearbyPlaces({
  places,
  searchQuery,
  isLoading,
  onSelectPlace,
  onStartNavigation,
  onPickCategory,
}: {
  places: Place[];
  searchQuery: string;
  isLoading: boolean;
  onSelectPlace: (place: Place) => void;
  onStartNavigation: (place: Place) => void;
  /** Called when a chip is picked, so the sheet can open up to show the results. */
  onPickCategory: () => void;
}) {
  const [category, setCategory] = useState<string | null>(null);

  const counts = new Map<string, number>();
  for (const p of places) counts.set(typeOf(p), (counts.get(typeOf(p)) ?? 0) + 1);
  const chips = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CHIPS).map(([type]) => type);
  const visible = category ? places.filter((p) => typeOf(p) === category) : places;

  const chipClass = (active: boolean) =>
    `flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
      active ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"
    }`;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-shrink-0 px-3 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        <button onClick={() => setCategory(null)} className={chipClass(category === null)} style={category === null ? { backgroundColor: "#111827" } : undefined}>
          All ({places.length})
        </button>
        {chips.map((type) => {
          const active = category === type;
          const color = categoryColor(type);
          return (
            <button
              key={type}
              onClick={() => {
                setCategory(active ? null : type);
                onPickCategory();
              }}
              className={chipClass(active)}
              style={active ? { backgroundColor: color } : undefined}
            >
              <CategoryIcon type={type} color={active ? "white" : color} />
              {categoryLabel(type)} ({counts.get(type)})
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 scrollbar-thin scrollbar-thumb-gray-300">
        {visible.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {isLoading ? "Fetching nearby places…" : searchQuery ? `No matches for "${searchQuery}".` : "No places found nearby."}
          </div>
        ) : (
          visible.map((place) => (
            <div
              key={place.id}
              onClick={() => onSelectPlace(place)}
              className="p-3.5 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200 rounded-xl flex items-center gap-3 cursor-pointer transition-colors"
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: categoryColor(place.type) }}>
                <CategoryIcon type={place.type} color="white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-gray-800 truncate">{place.name}</h4>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{categoryLabel(place.type)}</span>
              </div>
              <NavigateButton size="round" onClick={() => onStartNavigation(place)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
