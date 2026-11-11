"use client";

import React from "react";
import { ArrowLeftRight, Bus, Info, Car, Footprints, Motorbike, MoveRight, Route, Signpost, Wallet, type LucideIcon } from "lucide-react";
import type { TravelMode } from "./sidebar";

/** Lucide has no tricycle — a motorbike with a roofed sidecar, drawn in the same 24px/2px-stroke style. */
function TricycleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="18.5" cy="18" r="2.5" />
      <path d="M7.5 18h8.5" />
      <path d="M5 15.5 7.5 9H10" />
      <path d="M12 15V8a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v7" />
      <path d="M12 11h9" />
    </svg>
  );
}

type ModeTheme = { label: string; Icon: LucideIcon | typeof TricycleIcon; tile: string; accent: string; chip: string };

// Full literal class strings (Tailwind only generates classes it can see in source).
const THEMES: Record<TravelMode, ModeTheme> = {
  driving: { label: "Driving", Icon: Car, tile: "bg-blue-50 text-blue-600 ring-blue-100", accent: "text-blue-600", chip: "bg-blue-50 text-blue-700" },
  walking: { label: "Walking", Icon: Footprints, tile: "bg-emerald-50 text-emerald-600 ring-emerald-100", accent: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700" },
  cycling: { label: "Motor", Icon: Motorbike, tile: "bg-amber-50 text-amber-600 ring-amber-100", accent: "text-amber-600", chip: "bg-amber-50 text-amber-700" },
  tricycle: { label: "Tricycle", Icon: TricycleIcon, tile: "bg-violet-50 text-violet-600 ring-violet-100", accent: "text-violet-600", chip: "bg-violet-50 text-violet-700" },
  transit: { label: "Jeepney", Icon: Bus, tile: "bg-teal-50 text-teal-600 ring-teal-100", accent: "text-teal-600", chip: "bg-teal-50 text-teal-700" },
};

export interface RouteSummary {
  durationMin: number;
  distanceKm?: string;
  /** Pesos — shown as the highlighted chip when present. */
  fare?: number;
  /** e.g. "Route 1 of 2", "Direct", "1 transfer" — its kind picks the chip icon. */
  note?: string;
  noteKind?: "alternate" | "direct" | "transfer";
}

function formatDuration(min: number) {
  if (min < 60) return { value: String(min), unit: "min" };
  const h = Math.floor(min / 60);
  const m = min % 60;
  return { value: m ? `${h} h ${m}` : `${h}`, unit: m ? "min" : "h" };
}

function Chip({ icon: Icon, children, className = "bg-gray-100 text-gray-700" }: { icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${className}`}>
      <Icon className="h-3.5 w-3.5 opacity-80" strokeWidth={2.25} />
      {children}
    </span>
  );
}

export default function RouteSummaryCard({
  mode,
  summary,
  loading,
  emptyText = "No route for this mode",
  notice,
}: {
  mode: TravelMode;
  summary: RouteSummary | null;
  loading: boolean;
  /** Shown instead of a time when routing finished with nothing for this mode. */
  emptyText?: string;
  /** Optional one-line heads-up shown under the stats (e.g. walking is about as fast). */
  notice?: string;
}) {
  const theme = THEMES[mode];
  const { Icon } = theme;
  const time = summary ? formatDuration(summary.durationMin) : null;

  const hasChips = !!summary && (!!summary.distanceKm || summary.fare !== undefined || !!summary.note);
  const NoteIcon = summary?.noteKind === "transfer" ? ArrowLeftRight : summary?.noteKind === "direct" ? MoveRight : Signpost;

  return (
    <div className="border-b border-gray-200 bg-gray-50/70 p-3">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 p-3.5">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ${theme.tile}`}>
            <Icon className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className={`text-[10px] font-extrabold uppercase tracking-widest ${theme.accent}`}>{theme.label}</div>
            {time ? (
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-[26px] font-black leading-none tracking-tight text-gray-900 tabular-nums">{time.value}</span>
                <span className="text-sm font-bold text-gray-500">{time.unit}</span>
              </div>
            ) : loading ? (
              <div className="mt-1.5 h-6 w-24 animate-pulse rounded-md bg-gray-100" />
            ) : (
              <div className="mt-1 text-sm font-semibold text-gray-500">{emptyText}</div>
            )}

            {hasChips && summary && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {summary.fare !== undefined && (
                  <Chip icon={Wallet} className={theme.chip}>
                    ₱{summary.fare.toFixed(2)}
                  </Chip>
                )}
                {summary.distanceKm && <Chip icon={Route}>{summary.distanceKm} km</Chip>}
                {summary.note && <Chip icon={NoteIcon}>{summary.note}</Chip>}
              </div>
            )}
          </div>
        </div>

        {notice && (
          <p className="flex items-start gap-1.5 border-t border-amber-100 bg-amber-50 px-3.5 py-2 text-[11px] font-medium leading-snug text-amber-800">
            <Footprints className="mt-px h-3.5 w-3.5 shrink-0" />
            {notice}
          </p>
        )}
        <p className="flex items-center gap-1.5 border-t border-gray-100 bg-gray-50/60 px-3.5 py-2 text-[10px] text-gray-400">
          <Info className="h-3 w-3 shrink-0" />
          Estimates — may vary with traffic and waiting time.
        </p>
      </div>
    </div>
  );
}
