// "Jeepney Routes" tab: every route, each direction a button that isolates it on the map.

import { JEEPNEY_SWATCH_COLORS } from "../../../domain/jeepneyColors";
import { mockRoutes } from "../../../domain/MockData";

function DirectionButton({ label, arrow, isolated, onClick }: { label: string; arrow: string; isolated: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-xs font-medium p-2 rounded-lg flex items-center justify-between transition-colors ${
        isolated ? "bg-blue-600 text-white font-bold" : "bg-gray-50 hover:bg-gray-100 text-gray-600"
      }`}
    >
      <span className="truncate">
        {arrow} {label}
      </span>
      <span className="text-[10px] opacity-70 ml-2">Show</span>
    </button>
  );
}

export default function JeepneyRouteIndex({
  visibleRouteIds,
  isolatedDirectionId,
  onSelectRoute,
}: {
  visibleRouteIds: string[];
  isolatedDirectionId: string | null;
  onSelectRoute: (routeId: string, directionId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Interactive Route Index</h3>
      {mockRoutes.map((route) => (
        <div
          key={route.id}
          className={`p-4 rounded-xl border transition-all ${
            visibleRouteIds.includes(route.id) ? "bg-white border-gray-200 shadow-sm" : "bg-gray-50 border-gray-100 opacity-60 hover:opacity-85"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: JEEPNEY_SWATCH_COLORS[route.colorCode] }} />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{route.routeCode}</span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{route.colorCode}</span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <DirectionButton
              arrow="➡️"
              label={route.routeName}
              isolated={isolatedDirectionId === `${route.id}-fwd`}
              onClick={() => onSelectRoute(route.id, `${route.id}-fwd`)}
            />
            <DirectionButton
              arrow="⬅️"
              label={route.reversedName}
              isolated={isolatedDirectionId === `${route.id}-rev`}
              onClick={() => onSelectRoute(route.id, `${route.id}-rev`)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
