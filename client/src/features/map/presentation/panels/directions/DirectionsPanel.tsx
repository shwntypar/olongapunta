// Everything shown while a trip is being routed: who/where, the summary card,
// mode buttons, the options for the mode, steps and the fare. Used by both the
// desktop sidebar and the phone/tablet bottom sheet.

import { describeMixedRoute, distinctRideChains } from "../../../application/martins/mixedRouteShape";
import { serviceHoursLabel } from "../../../domain/jeepneyService";
import { rideCount } from "../../../application/martins/routeMetrics";
import RouteSummaryCard from "../../route-summary-card";
import type { DirectionsProps } from "../types";
import { buildSummary } from "./directionsSummary";
import FareFooter from "./FareFooter";
import ModeTabs from "./ModeTabs";
import OptionList from "./OptionList";
import StepList from "./StepList";
import TransitAlternatives from "./TransitAlternatives";
import TripHeader from "./TripHeader";

function emptyTricycleText(walkOnly: boolean) {
  return walkOnly ? "No tricycle stop within reach — walking is faster" : "No tricycle zone covers this trip";
}

/** Why a mode finished with nothing to show, for the summary card and the step list; null while it can still load. */
function emptyState(props: DirectionsProps): { card: string; steps: string } | null {
  if (props.mode === "transit" && props.origin && !props.isPlanningTransit && props.transitRoutes.length === 0) {
    return props.transitWalkMinutes !== null
      ? {
          card: "No jeepney saves time here",
          steps: props.transitTricycle
            ? `🚐 No jeepney saves time on this trip — a tricycle (~${props.transitTricycle.minutes} min) or walking (~${props.transitWalkMinutes} min) is better.`
            : `🚶 No jeepney saves time on this trip — walking takes about ${props.transitWalkMinutes} min.`,
        }
      : { card: "No jeepney route covers this trip", steps: "🚐 No jeepney route passes close enough to both ends of this trip." };
  }
  if (props.mode === "tricycle" && props.tricycleRoutes.length === 0) {
    return {
      card: emptyTricycleText(props.tricycleWalkOnly),
      steps: props.tricycleWalkOnly
        ? "🚶 No tricycle stop is within reach for this trip — walking is your best option."
        : "🛺 No tricycle zone covers this trip yet.",
    };
  }
  if (props.mode === "mixed" && !props.isPlanningMixed && props.mixedRoutes.length === 0) {
    return {
      card: "No tricycle or jeepney reaches this trip",
      steps: "🚶 No tricycle or jeepney combination reaches this trip — walking is your best option.",
    };
  }
  return null;
}

/** "J-01 (GREEN) also serves this trip but runs 6–9 AM only." */
function notRunningNotice(props: DirectionsProps): string | undefined {
  if (props.mode !== "transit" || props.transitNotRunning.length === 0) return undefined;
  return props.transitNotRunning
    .map((r) => `${r.routeCode} (${r.colorCode}) ${props.transitRoutes.length ? "also serves" : "would serve"} this trip but runs ${serviceHoursLabel(r.colorCode) ?? "limited hours"}.`)
    .join(" ");
}

/** Heads-up when walking alone is about as good as riding (short trips). */
function shortTripNotice(props: DirectionsProps): string | undefined {
  if (props.mode === "transit" && props.transitSavesLittle && props.transitRoutes.length > 0 && props.transitWalkMinutes !== null) {
    return `Short trip — walking takes about ${props.transitWalkMinutes} min, so the jeepney mainly saves you the walk.`;
  }
  if (props.mode === "tricycle" && props.tricycleWalkOnly && props.tricycleRoutes.length > 0 && props.tricycleWalkMinutes !== null) {
    return `Short trip — walking takes about ${props.tricycleWalkMinutes} min, so the tricycle mainly saves you the walk.`;
  }
  if (props.mode === "mixed" && props.mixedWalkOnly && props.mixedRoutes.length > 0 && props.mixedWalkMinutes !== null) {
    return `Short trip — walking takes about ${props.mixedWalkMinutes} min, so riding mainly saves you the walk.`;
  }
  return undefined;
}

function ModeOptions(props: DirectionsProps) {
  const { mode } = props;

  if (mode === "transit" && props.transitRoutes.length > 0) {
    const labels = distinctRideChains(props.transitRoutes.map(describeMixedRoute));
    return (
      <OptionList
        title="Jeepney Options"
        options={props.transitRoutes.map((r, i) => {
          const rides = r.legs.filter((l) => l.transition === "board-jeep").length;
          return {
            label: labels[i],
            detail: `~${Math.round(r.cost[0])} min • ₱${r.cost[1].toFixed(2)} • ${rides >= 2 ? `${rides - 1} transfer${rides > 2 ? "s" : ""}` : "Direct"}`,
          };
        })}
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

  if (mode === "mixed" && props.mixedRoutes.length > 0) {
    const labels = distinctRideChains(props.mixedRoutes.map(describeMixedRoute));
    return (
      <OptionList
        tone="rose"
        title="Ride Combinations"
        options={props.mixedRoutes.map((r, i) => ({
          label: labels[i],
          detail: `~${Math.round(r.cost[0])} min • ₱${r.cost[1].toFixed(2)}`,
        }))}
        activeIdx={props.activeMixedIdx}
        onSelect={props.setActiveMixedIdx}
      />
    );
  }

  const isRoadMode = mode === "driving" || mode === "walking" || mode === "cycling";
  if (isRoadMode && props.roadRoutes.length > 1) {
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
  const empty = emptyState(props);

  return (
    <div className={`flex flex-col min-h-0 bg-white ${props.className ?? ""}`}>
      <TripHeader origin={props.origin} destination={props.destination} onSelectOriginMode={props.onSelectOriginMode} onClose={props.onCloseRouting} />

      <RouteSummaryCard
        mode={props.mode}
        summary={buildSummary(props)}
        // Once tricycle/mixed routing has run with nothing to show, say why instead of spinning.
        loading={props.routeSteps.length === 0 && !empty}
        emptyText={empty?.card ?? "No route for this mode"}
        notice={[shortTripNotice(props), notRunningNotice(props)].filter(Boolean).join(" ") || undefined}
      />

      <TransitAlternatives {...props} />

      <ModeTabs mode={props.mode} setMode={props.setMode} excluded={props.destination?.excludeModes} />
      <ModeOptions {...props} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
        <StepList steps={props.routeSteps} emptyText={empty?.steps} />
      </div>

      <FareFooter {...props} />
    </div>
  );
}
