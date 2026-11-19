// Under the Transit summary when no jeepney clearly beats walking (or none
// covers the trip): the other ways to make the trip, one tap away —
// a tricycle (with its time and fare), walking, or Mixed.

import type { DirectionsProps } from "../types";

function Choice({ onClick, tone, children }: { onClick: () => void; tone: "violet" | "emerald" | "rose"; children: React.ReactNode }) {
  const tones = {
    violet: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    rose: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${tones[tone]}`}>
      {children}
    </button>
  );
}

export default function TransitAlternatives(props: DirectionsProps) {
  if (props.mode !== "transit" || !props.origin) return null;
  if (props.isPlanningTransit) return null;
  const noJeepney = props.transitRoutes.length === 0;
  if (!noJeepney && !props.transitSavesLittle) return null; // a jeepney clearly wins: nothing to add

  const trike = props.destination?.excludeModes?.includes("tricycle") ? null : props.transitTricycle;
  const walk = props.transitSavesLittle && props.transitWalkMinutes !== null;
  const mixed = noJeepney;
  if (!trike && !walk && !mixed) return null;

  return (
    <div className="border-b border-gray-200 bg-white px-3 py-2.5">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-gray-400">{noJeepney ? "Instead, take" : "Other ways"}</span>
      <div className="flex flex-wrap gap-1.5">
        {trike && (
          <Choice tone="violet" onClick={() => props.setMode("tricycle")}>
            🛺 Tricycle ~{trike.minutes} min · ₱{trike.fare.toFixed(0)}
          </Choice>
        )}
        {walk && (
          <Choice tone="emerald" onClick={() => props.setMode("walking")}>
            🚶 Walk ~{props.transitWalkMinutes} min
          </Choice>
        )}
        {mixed && (
          <Choice tone="rose" onClick={() => props.setMode("mixed")}>
            🔀 Mixed — tricycle + jeepney
          </Choice>
        )}
      </div>
    </div>
  );
}
