// Everything shown while a trip is being routed: who/where, the summary card,
// mode buttons, the options for the mode, steps and the fare. Used by both the
// desktop sidebar and the phone/tablet bottom sheet.

import { rideCount } from "../../../application/martins/routeMetrics";
import RouteSummaryCard from "../../route-summary-card";
import type { DirectionsProps } from "../types";
import { buildSummary, transitFare } from "./directionsSummary";
import FareFooter from "./FareFooter";
import ModeTabs from "./ModeTabs";
import OptionList from "./OptionList";
import StepList from "./StepList";
import TripHeader from "./TripHeader";

function emptyTricycleText(walkOnly: boolean) {
  return walkOnly ? "No tricycle stop within reach — walking is faster" : "No tricycle zone covers this trip";
}

function ModeOptions(props: DirectionsProps) {
  const { mode } = props;

  if (mode === "transit" && props.transitCandidates.length > 1) {
    return (
      <OptionList
        title="Alternative Jeepney Transfers"
        options={props.transitCandidates.map((c) => ({
          label: c.transfer ? `${c.jeepney.routeCode} ➔ ${c.transfer.jeepney.routeCode}` : c.jeepney.routeCode,
          detail: `₱${transitFare(c).toFixed(2)} • ${c.transfer ? "1 Transfer" : "Direct"}`,
        }))}
        activeIdx={props.activeTransitIdx}
        onSelect={props.setActiveTransitIdx}
      />
    );
  }

  if (mode === "tricycle" && props.tricycleRoutes.length > 0) {
    return (
      <OptionList
        tone="violet"
        title="Tricycle Options"
        options={props.tricycleRoutes.map((r) => ({
          label: rideCount(r) >= 2 ? "Transfer" : "Direct",
          detail: `~${r.cost[0].toFixed(1)} min • ₱${r.cost[1].toFixed(2)}`,
        }))}
        activeIdx={props.activeTricycleIdx}
        onSelect={props.setActiveTricycleIdx}
      />
    );
  }

  if (mode !== "transit" && mode !== "tricycle" && props.roadRoutes.length > 1) {
    return (
      <OptionList
        title="Alternate Routes Available"
        options={props.roadRoutes.map((r, i) => ({
          label: `Route ${i + 1} (${r.summary || "Main Path"})`,
          detail: `~${Math.round((r.duration ?? 0) / 60)} mins • ${(r.distance / 1000).toFixed(1)} km`,
        }))}
        activeIdx={props.activeRoadIdx}
        onSelect={props.setActiveRoadIdx}
      />
    );
  }

  return null;
}

export default function DirectionsPanel(props: DirectionsProps & { className?: string }) {
  const isTricycle = props.mode === "tricycle";
  const tricycleEmpty = isTricycle && props.tricycleRoutes.length === 0;
  const shortTripNotice =
    isTricycle && props.tricycleWalkOnly && props.tricycleRoutes.length > 0 && props.tricycleWalkMinutes !== null
      ? `Short trip — walking takes about ${props.tricycleWalkMinutes} min, so the tricycle mainly saves you the walk.`
      : undefined;

  return (
    <div className={`flex flex-col min-h-0 bg-white ${props.className ?? ""}`}>
      <TripHeader origin={props.origin} destination={props.destination} onSelectOriginMode={props.onSelectOriginMode} onClose={props.onCloseRouting} />

      <RouteSummaryCard
        mode={props.mode}
        summary={buildSummary(props)}
        // Tricycle routing is synchronous: once it has run with nothing to show, say why instead of spinning.
        loading={props.routeSteps.length === 0 && !tricycleEmpty}
        emptyText={isTricycle ? emptyTricycleText(props.tricycleWalkOnly) : "No route for this mode"}
        notice={shortTripNotice}
      />

      <ModeTabs mode={props.mode} setMode={props.setMode} excluded={props.destination?.excludeModes} />
      <ModeOptions {...props} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
        <StepList
          steps={props.routeSteps}
          emptyText={
            tricycleEmpty
              ? props.tricycleWalkOnly
                ? "🚶 No tricycle stop is within reach for this trip — walking is your best option."
                : "🛺 No tricycle zone covers this trip yet."
              : undefined
          }
        />
      </div>

      <FareFooter {...props} />
    </div>
  );
}
