import type { TravelMode } from "../../../domain/types";

const MODES: TravelMode[] = ["driving", "walking", "cycling", "transit", "tricycle"];
const LABEL: Record<TravelMode, string> = { driving: "Driving", walking: "Walking", cycling: "Motor", transit: "Transit", tricycle: "Tricycle" };

/**
 * Travel-mode buttons. A destination can exclude modes that make no sense for
 * it (a tricycle stand excludes Tricycle). A grid, so every button always fits.
 */
export default function ModeTabs({ mode, setMode, excluded = [] }: { mode: TravelMode; setMode: (mode: TravelMode) => void; excluded?: TravelMode[] }) {
  const available = MODES.filter((m) => !excluded.includes(m));
  return (
    <div className="p-3 border-b border-gray-200 bg-white grid gap-1" style={{ gridTemplateColumns: `repeat(${available.length}, minmax(0, 1fr))` }}>
      {available.map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`py-2 px-0.5 text-[10px] leading-tight font-bold rounded-lg border transition-all flex items-center justify-center ${
            mode === m ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20" : "bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          {LABEL[m]}
        </button>
      ))}
    </div>
  );
}
