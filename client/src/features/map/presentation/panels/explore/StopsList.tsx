// "Stops" tab: tricycle stands grouped by TODA zone (and, once verified, jeepney stops by route).

import type { ReactNode } from "react";
import { SHOW_JEEPNEY_STOPS } from "../../../config";
import { JEEPNEY_SWATCH_COLORS } from "../../../domain/jeepneyColors";
import { mockRoutes } from "../../../domain/MockData";
import { tricycleZones } from "../../../domain/TricycleZoneData";
import type { Place } from "../../../domain/types";
import { formatZoneFare } from "../../../domain/zoneFare";
import NavigateButton from "../NavigateButton";

interface GroupProps {
  color: string;
  code: string;
  name: string;
  fare: string;
  stops: Place[];
  icon: string;
  emptyText: string;
  onSelectPlace: (place: Place) => void;
  onStartNavigation: (place: Place) => void;
}

function StopGroup({ color, code, name, fare, stops, icon, emptyText, onSelectPlace, onStartNavigation }: GroupProps) {
  return (
    <div className="p-4 rounded-xl border bg-white border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-black/10" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{code}</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate">{name}</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">{fare}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {stops.length === 0 ? (
          <div className="text-xs text-gray-400 italic px-1 py-1">{emptyText}</div>
        ) : (
          stops.map((stop) => (
            <div
              key={stop.id}
              onClick={() => onSelectPlace(stop)}
              className="group w-full flex items-center justify-between gap-3 text-left text-xs font-medium px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 cursor-pointer transition-colors"
            >
              <span className="truncate leading-relaxed">
                {icon} {stop.name}
              </span>
              <NavigateButton size="sm" onClick={() => onStartNavigation(stop)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3.5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">{title}</h3>
      {children}
    </div>
  );
}

export default function StopsList({
  places,
  onSelectPlace,
  onStartNavigation,
}: {
  places: Place[];
  onSelectPlace: (place: Place) => void;
  onStartNavigation: (place: Place) => void;
}) {
  const actions = { onSelectPlace, onStartNavigation };

  return (
    <div className="space-y-7">
      <Section title="Tricycle Zones & Stops">
        {tricycleZones.map((zone) => (
          <StopGroup
            key={zone.id}
            color={zone.color}
            code={zone.code}
            name={zone.name}
            fare={formatZoneFare(zone)}
            stops={places.filter((p) => p.type === "tricycle_stand" && p.zoneId === zone.id)}
            icon="🛺"
            emptyText="No surveyed stops yet for this zone."
            {...actions}
          />
        ))}
      </Section>

      {/* Off until the stop coordinates are verified (SHOW_JEEPNEY_STOPS in config.ts). */}
      {SHOW_JEEPNEY_STOPS && (
        <Section title="Jeepney Routes & Stops">
          {mockRoutes.map((route) => (
            <StopGroup
              key={route.id}
              color={JEEPNEY_SWATCH_COLORS[route.colorCode]}
              code={route.routeCode}
              name={route.routeName}
              fare={`₱${route.baseFare.toFixed(2)} per ride`}
              stops={places.filter((p) => p.type === "jeepney_stop" && p.routeId === route.id)}
              icon="🚐"
              emptyText="No stops listed yet for this route."
              {...actions}
            />
          ))}
        </Section>
      )}
    </div>
  );
}
