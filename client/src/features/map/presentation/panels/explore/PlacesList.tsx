// Desktop "Explore Places" tab: every place matching the search box.

import type { Place } from "../../../domain/types";
import NavigateButton from "../NavigateButton";
import Spinner from "../Spinner";

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
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Nearby Spots ({places.length})</h3>
        {isLoading && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-500">
            <Spinner />
            Loading nearby places…
          </span>
        )}
      </div>

      {places.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {isLoading ? (
            <span className="flex flex-col items-center gap-2">
              <Spinner className="w-5 h-5 text-blue-400" />
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
                <h4 className="font-semibold text-gray-800 group-hover:text-gray-950 transition-colors">{place.name}</h4>
                <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 mt-1 bg-gray-100 text-gray-500 rounded-md">
                  {place.type?.replace("_", " ")}
                </span>
              </div>
              <NavigateButton onClick={() => onStartNavigation(place)} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
