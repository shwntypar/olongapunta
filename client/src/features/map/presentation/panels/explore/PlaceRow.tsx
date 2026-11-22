// One place in a list: coloured category icon, name, "Category · where it is",
// and the directions button. Shared by the desktop sidebar and the phone sheet.

import type { Place } from "../../../domain/types";
import CategoryIcon from "../../components/CategoryIcon";
import { categoryLabel, placeColor } from "../../placeCategories";
import NavigateButton from "../NavigateButton";

export default function PlaceRow({ place, onSelect, onNavigate }: { place: Place; onSelect: () => void; onNavigate: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-place-row
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="group flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: placeColor(place) }}>
        <CategoryIcon type={place.type} color="white" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-semibold text-gray-900">{place.name}</h4>
        <p className="truncate text-xs text-gray-500">
          <span className="font-medium text-gray-600">{categoryLabel(place.type)}</span>
          {place.where && <> · {place.where}</>}
        </p>
      </div>
      <NavigateButton size="round" onClick={onNavigate} />
    </div>
  );
}
