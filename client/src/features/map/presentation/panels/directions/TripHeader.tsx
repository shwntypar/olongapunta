import type { Origin, Place } from "../../../domain/types";
import { CloseIcon } from "../../components/icons";

/** "Directions — From: … / To: …" with the close button. */
export default function TripHeader({
  origin,
  destination,
  onSelectOriginMode,
  onClose,
}: {
  origin: Origin | null;
  destination: Place | null;
  onSelectOriginMode: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-4 border-b border-gray-200 flex items-start justify-between">
      <div className="min-w-0 pr-4">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
          Directions
        </span>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-10 flex-shrink-0">From:</span>
            <span className="font-semibold text-gray-800 truncate">{origin?.name || "Select starting point..."}</span>
            <button
              onClick={onSelectOriginMode}
              className="flex-shrink-0 text-[10px] font-bold text-blue-600 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors whitespace-nowrap"
              title="Choose starting point on the map"
            >
              {origin ? "Change" : "Choose on map"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-10 flex-shrink-0">To:</span>
            <span className="font-semibold text-gray-800 truncate">{destination?.name || "Unnamed"}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Close directions"
        className="p-1.5 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-900 rounded-lg transition-all"
      >
        <CloseIcon className="w-5 h-5" strokeWidth={2} />
      </button>
    </div>
  );
}
