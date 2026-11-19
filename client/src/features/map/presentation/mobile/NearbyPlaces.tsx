// Phone/tablet "Nearby" tab: category chips (the eight most common types) over the matching places.

import { useState } from "react";
import type { Place } from "../../domain/types";
import CategoryChips, { filterByCategory } from "../components/CategoryChips";
import PlaceRow from "../panels/explore/PlaceRow";

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
  const [chosen, setChosen] = useState<string | null>(null);
  const { places: visible, category } = filterByCategory(places, chosen);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-shrink-0 px-3 pb-3">
        <CategoryChips
          places={places}
          category={category}
          onChange={(next) => {
            setChosen(next);
            if (next) onPickCategory();
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-4 divide-y divide-gray-100 scrollbar-thin scrollbar-thumb-gray-300">
        {visible.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {isLoading ? "Fetching nearby places…" : searchQuery ? `No matches for "${searchQuery}".` : "No places found nearby."}
          </div>
        ) : (
          visible.map((place) => (
            <PlaceRow key={place.id} place={place} onSelect={() => onSelectPlace(place)} onNavigate={() => onStartNavigation(place)} />
          ))
        )}
      </div>
    </div>
  );
}
