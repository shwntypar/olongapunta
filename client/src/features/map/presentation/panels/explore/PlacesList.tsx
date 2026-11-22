// Desktop "Explore Places" tab: a pinned strip of category chips over every
// place matching the search box.

import { useState } from "react";
import type { Place } from "../../../domain/types";
import CategoryChips, { filterByCategory } from "../../components/CategoryChips";
import Spinner from "../Spinner";
import PlaceRow from "./PlaceRow";

export default function PlacesList({
  places,
  isLoading,
  onSelectPlace,
  onStartNavigation,
}: {
  places: Place[];
  isLoading: boolean;
  onSelectPlace: (place: Place) => void;
  onStartNavigation: (place: Place) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const { places: visible, category } = filterByCategory(places, chosen);

  return (
    <div>
      {/* Pinned while the list scrolls. -mt/-mx undo the sidebar's padding so the white band reaches the edges. */}
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 bg-white px-4 pt-4 pb-2.5 border-b border-gray-100 shadow-[0_6px_8px_-8px_rgba(0,0,0,0.15)]">
        {places.length > 0 && <CategoryChips places={places} category={category} onChange={setChosen} arrows />}
        <div className="mt-2.5 flex items-center justify-between px-0.5 text-[11px] font-semibold text-gray-400">
          <span>
            {visible.length} {visible.length === 1 ? "place" : "places"}
          </span>
          {isLoading && (
            <span className="flex items-center gap-1.5 text-blue-500">
              <Spinner />
              Loading nearby places…
            </span>
          )}
        </div>
      </div>

      {places.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          {isLoading ? (
            <span className="flex flex-col items-center gap-2">
              <Spinner className="h-5 w-5 text-blue-400" />
              Fetching nearby places — this can take a moment.
            </span>
          ) : (
            "No matching places found. Try another search."
          )}
        </div>
      ) : (
        <div className="-mx-2 mt-1 divide-y divide-gray-100">
          {visible.map((place) => (
            <PlaceRow key={place.id} place={place} onSelect={() => onSelectPlace(place)} onNavigate={() => onStartNavigation(place)} />
          ))}
        </div>
      )}
    </div>
  );
}
