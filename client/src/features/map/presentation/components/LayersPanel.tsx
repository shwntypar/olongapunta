// The "Layers" button and its dropdown: show/hide jeepney routes by colour,
// and TODA zones one by one.

import { useState } from "react";
import { JEEPNEY_LINE_COLORS } from "../../domain/jeepneyColors";
import { mockRoutes, type JeepneyColor } from "../../domain/MockData";
import { tricycleZones } from "../../domain/TricycleZoneData";
import { LayersIcon } from "./icons";

const routeIdsOfColor = (color: string) => mockRoutes.filter((r) => r.colorCode === color).map((r) => r.id);

function ToggleChip({ label, color, active, labelClass, onClick }: { label: string; color: string; active: boolean; labelClass: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full font-semibold text-xs whitespace-nowrap transition-all flex items-center gap-1.5 border ${
        active ? "bg-gray-50 text-gray-900 border-current" : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
      }`}
      style={{ color: active ? color : undefined }}
    >
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, opacity: active ? 1 : 0.4 }} />
      <span className={labelClass}>{label}</span>
    </button>
  );
}

function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h4>
      <button onClick={onAction} className="text-[11px] font-bold text-blue-600 hover:text-blue-700">
        {actionLabel}
      </button>
    </div>
  );
}

export default function LayersPanel({
  visibleRouteIds,
  onToggleRouteColor,
  onSetAllRoutesVisible,
  visibleZoneIds,
  onToggleZone,
  onShowAllZones,
}: {
  visibleRouteIds: string[];
  onToggleRouteColor: (color: JeepneyColor) => void;
  onSetAllRoutesVisible: (visible: boolean) => void;
  visibleZoneIds: string[];
  onToggleZone: (zoneId: string) => void;
  onShowAllZones: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const allRoutesVisible = mockRoutes.every((r) => visibleRouteIds.includes(r.id));

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setIsOpen((open) => !open)}
        className={`flex items-center gap-1.5 h-10 px-3.5 rounded-full font-bold text-sm shadow-md transition-all ${
          isOpen ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
        }`}
        title="Map layers"
      >
        <LayersIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Layers</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 top-full mt-2 z-20 w-[min(22rem,calc(100vw-2rem))] max-h-[65vh] overflow-y-auto scrollbar-thin bg-white rounded-2xl shadow-xl border border-gray-100 p-4 space-y-4">
            <div>
              <SectionHeader
                title="Jeepney Routes"
                actionLabel={allRoutesVisible ? "Hide all" : "Show all"}
                onAction={() => onSetAllRoutesVisible(!allRoutesVisible)}
              />
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(JEEPNEY_LINE_COLORS) as [JeepneyColor, string][]).map(([colorName, hex]) => {
                  const ids = routeIdsOfColor(colorName);
                  const active = ids.length > 0 && ids.every((id) => visibleRouteIds.includes(id));
                  return (
                    <ToggleChip
                      key={colorName}
                      label={colorName}
                      color={hex}
                      active={active}
                      labelClass={active ? "" : "text-gray-500"}
                      onClick={() => onToggleRouteColor(colorName)}
                    />
                  );
                })}
              </div>
            </div>

            {tricycleZones.length > 0 && (
              <div className="pt-3.5 border-t border-gray-100">
                <SectionHeader title="Tricycle Zones" actionLabel="Show all" onAction={onShowAllZones} />
                <div className="flex flex-wrap gap-1.5">
                  {tricycleZones.map((zone) => {
                    const active = visibleZoneIds.includes(zone.id);
                    return (
                      <ToggleChip
                        key={zone.id}
                        label={zone.code}
                        color={zone.color}
                        active={active}
                        labelClass={active ? "text-gray-900" : "text-gray-500"}
                        onClick={() => onToggleZone(zone.id)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
