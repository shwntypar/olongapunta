// Category filter chips ("All", then the most common place types) on one
// sideways-scrolling line, shared by the desktop "Explore Places" list and
// the phone/tablet "Nearby" tab. With `arrows`, ◀ ▶ buttons and faded edges
// appear when there's more to scroll to (for a mouse; touch just swipes).

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Place } from "../../domain/types";
import { categoryColor, categoryLabel } from "../placeCategories";
import CategoryIcon from "./CategoryIcon";

const MAX_CHIPS = 8;

export const placeCategory = (p: Place) => (p.type || "other").toLowerCase();

/**
 * The places in `category` (all of them for null), and the category actually
 * applied: a chosen category with no matches left (the search changed) falls
 * back to "All" rather than showing an empty list.
 */
export function filterByCategory(places: Place[], category: string | null) {
  const inCategory = category ? places.filter((p) => placeCategory(p) === category) : places;
  return inCategory.length > 0 || !category ? { places: inCategory, category } : { places, category: null };
}

function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "border-transparent text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      {children}
    </button>
  );
}

const Count = ({ n, active }: { n: number; active: boolean }) => (
  <span className={`text-[11px] font-medium tabular-nums ${active ? "text-white/75" : "text-gray-400"}`}>{n}</span>
);

export default function CategoryChips({
  places,
  category,
  onChange,
  arrows = false,
}: {
  /** The places to count (already search-filtered). */
  places: Place[];
  category: string | null;
  onChange: (category: string | null) => void;
  /** Show ◀ ▶ scroll buttons (mouse users). */
  arrows?: boolean;
}) {
  const counts = new Map<string, number>();
  for (const p of places) counts.set(placeCategory(p), (counts.get(placeCategory(p)) ?? 0) + 1);
  const chips = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CHIPS).map(([type]) => type);
  // Keep the chosen chip visible even if it isn't among the most common any more.
  if (category && counts.has(category) && !chips.includes(category)) chips.push(category);

  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = () => {
    const el = rowRef.current;
    if (el) setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    const el = rowRef.current;
    if (!el || !arrows) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [arrows, chips.length]);

  // Keep the chosen chip in view (it may sit past the visible end of the row).
  useEffect(() => {
    const row = rowRef.current;
    const active = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !active) return;
    const left = active.offsetLeft - row.offsetLeft;
    const pad = 48; // clear of the faded edge and its arrow
    if (left < row.scrollLeft + pad) row.scrollTo({ left: Math.max(0, left - pad), behavior: "smooth" });
    else if (left + active.offsetWidth > row.scrollLeft + row.clientWidth - pad) {
      row.scrollTo({ left: left + active.offsetWidth - row.clientWidth + pad, behavior: "smooth" });
    }
  }, [category]);

  const scrollBy = (dx: number) => rowRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className="relative">
      <div ref={rowRef} onScroll={arrows ? measure : undefined} className="flex gap-1.5 overflow-x-auto scroll-smooth scrollbar-hide" role="group" aria-label="Filter by category">
        <Chip active={category === null} color="#111827" onClick={() => onChange(null)}>
          All <Count n={places.length} active={category === null} />
        </Chip>
        {chips.map((type) => {
          const active = category === type;
          const color = categoryColor(type);
          return (
            <Chip key={type} active={active} color={color} onClick={() => onChange(active ? null : type)}>
              <CategoryIcon type={type} color={active ? "white" : color} size={13} />
              {categoryLabel(type)} <Count n={counts.get(type) ?? 0} active={active} />
            </Chip>
          );
        })}
      </div>

      {arrows && edges.left && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center bg-gradient-to-r from-white via-white/90 to-transparent">
          <button onClick={() => scrollBy(-200)} aria-label="Scroll categories left" className="pointer-events-auto grid h-7 w-7 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
      {arrows && edges.right && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-gradient-to-l from-white via-white/90 to-transparent">
          <button onClick={() => scrollBy(200)} aria-label="Scroll categories right" className="pointer-events-auto grid h-7 w-7 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
