import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** One line of the place card: an icon (or a small label) and its content. */
export default function DetailRow({ icon: Icon, label, children }: { icon?: LucideIcon; label?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-[13px] leading-snug">
      {Icon ? (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
      ) : (
        <span className="w-[72px] shrink-0 text-[11px] font-bold uppercase tracking-wide text-gray-400 pt-0.5">{label}</span>
      )}
      <div className="min-w-0 flex-1 text-gray-800 break-words">{children}</div>
    </div>
  );
}
