import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

const TONES = {
  info: "bg-blue-100 text-blue-600",
  warning: "bg-amber-100 text-amber-600",
} as const;

/** A pill-shaped notice floating over the top of the map, with a 📍 badge and a dismiss button. */
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
    <div className="absolute top-20 left-1/2 lg:left-[calc(50%+10rem)] -translate-x-1/2 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-sm text-gray-700 pl-2 pr-2.5 py-2 rounded-full shadow-md border border-gray-200 whitespace-nowrap">
      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm ${TONES[tone]}`}>📍</span>
      <span className="text-xs sm:text-sm font-medium">{message}</span>
      {children}
      <button
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="flex-shrink-0 w-6 h-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
