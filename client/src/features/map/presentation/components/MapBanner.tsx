import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

const TONES = {
  info: "bg-blue-100 text-blue-600",
  warning: "bg-amber-100 text-amber-600",
} as const;

/** A pill-shaped notice floating over the top of the map, with a 📍 badge and a labelled dismiss button ("✕ Cancel"). */
export default function MapBanner({
  tone,
  message,
  dismissLabel,
  onDismiss,
  children,
}: {
  tone: keyof typeof TONES;
  message: string;
  dismissLabel: string;
  onDismiss: () => void;
  /** Extra buttons shown before the dismiss button. */
  children?: ReactNode;
}) {
  return (
    // Never wider than the screen: on a phone the message wraps instead of pushing the Cancel button off the edge.
    <div className="absolute top-20 left-1/2 lg:left-[calc(50%+10rem)] -translate-x-1/2 z-30 flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-2 bg-white/95 backdrop-blur-sm text-gray-700 pl-2 pr-2.5 py-2 rounded-full shadow-md border border-gray-200">
      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm ${TONES[tone]}`}>📍</span>
      <span className="min-w-0 text-xs sm:text-sm font-medium leading-snug">{message}</span>
      {children}
      <button
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="flex-shrink-0 inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-bold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100"
      >
        <CloseIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
        {dismissLabel}
      </button>
    </div>
  );
}
