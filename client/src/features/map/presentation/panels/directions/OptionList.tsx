// A titled list of selectable options (alternate routes, jeepney transfers, tricycle options).

const TONES = {
  blue: { section: "bg-gray-50/60", title: "text-gray-400", selected: "bg-blue-50 border-blue-400 text-blue-700 font-bold" },
  violet: { section: "bg-violet-50/60", title: "text-violet-400", selected: "bg-violet-50 border-violet-400 text-violet-700 font-bold" },
} as const;

export interface OptionItem {
  label: string;
  detail: string;
}

export default function OptionList({
  title,
  options,
  activeIdx,
  onSelect,
  tone = "blue",
}: {
  title: string;
  options: OptionItem[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <div className={`p-3 border-b border-gray-200 ${t.section}`}>
      <span className={`text-[10px] font-black uppercase tracking-wider block mb-2.5 ${t.title}`}>{title}</span>
      <div className="space-y-1.5">
        {options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(idx)}
            className={`w-full text-left p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
              idx === activeIdx ? t.selected : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="truncate">{option.label}</span>
            <span className="flex-shrink-0">{option.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
