// The step-by-step list: Mapbox turn-by-turn for road modes, ride phases for jeepney/tricycle.

import type { DirectionsStep } from "../../../domain/types";
import { fareForStep } from "./directionsSummary";

const formatDistance = (meters: number) => (meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`);

function stepKind(text: string) {
  if (text.includes("BOARD:")) return "board";
  if (text.includes("ALIGHT:")) return "alight";
  if (text.includes("TRANSFER")) return "transfer";
  return "step";
}

const DOT = { board: "bg-yellow-500", alight: "bg-red-500", transfer: "bg-orange-500", step: "bg-gray-300" } as const;

function FareBadge({ label, tag, tone }: { label: string; tag: string; tone: "board" | "transfer" }) {
  const tagClass = tone === "board" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-orange-50 text-orange-700 border-orange-200";
  return (
    <div className="mt-2.5 flex items-center justify-between text-xs font-bold text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200">
      <span className={tone === "transfer" ? "text-orange-600" : undefined}>{label}</span>
      <span className={`px-2 py-0.5 rounded border ${tagClass}`}>{tag}</span>
    </div>
  );
}

export default function StepList({ steps, emptyText }: { steps: DirectionsStep[]; /** Shown instead of "Mapping…" when routing finished with nothing. */ emptyText?: string }) {
  if (steps.length === 0) {
    return emptyText ? (
      <div className="text-center py-12 text-gray-400 text-sm">{emptyText}</div>
    ) : (
      <div className="text-center py-12 text-gray-400 text-sm animate-pulse">Mapping the best route...</div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Step-by-step Navigation</h3>
      <div className="relative border-l-2 border-gray-200 pl-5 ml-2.5 space-y-5">
        {steps.map((step, idx) => {
          const text = step.maneuver.instruction;
          const kind = stepKind(text);
          return (
            <div key={idx} className="relative group">
              <div className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow transition-transform duration-200 group-hover:scale-125 ${DOT[kind]}`} />
              <div className="bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-sm p-3 rounded-xl transition-all">
                <p className="text-sm font-medium text-gray-800">{text}</p>
                {kind === "board" && <FareBadge label={`Fare: ${fareForStep(text)}`} tag="Boarding" tone="board" />}
                {kind === "transfer" && <FareBadge label={`Add'l Fare: ${fareForStep(text)}`} tag="Transfer" tone="transfer" />}
                {step.distance > 0 && <span className="inline-block mt-2 text-[11px] font-black text-gray-400">{formatDistance(step.distance)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
