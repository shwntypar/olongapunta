"use client";

// A draggable bottom sheet (phones and tablets) with three resting heights.
// Drag the handle to resize, or tap it to step through the heights.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PEEK_PX, snapHeight, type SheetSnap } from "./sheetLayout";

export type { SheetSnap };

function nearestSnap(height: number): SheetSnap {
  const options: SheetSnap[] = ["peek", "half", "full"];
  return options.reduce((best, s) => (Math.abs(snapHeight(s) - height) < Math.abs(snapHeight(best) - height) ? s : best));
}

const NEXT: Record<SheetSnap, SheetSnap> = { peek: "half", half: "full", full: "peek" };

export default function BottomSheet({ snap, onSnapChange, children }: { snap: SheetSnap; onSnapChange: (snap: SheetSnap) => void; children: ReactNode }) {
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const listeners = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null);
  const moved = useRef(false);

  const stopListening = () => {
    if (!listeners.current) return;
    window.removeEventListener("pointermove", listeners.current.move);
    window.removeEventListener("pointerup", listeners.current.up);
    listeners.current = null;
  };
  useEffect(() => stopListening, []);

  const startDrag = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const startHeight = snapHeight(snap);
    let height = startHeight;
    moved.current = false;

    const move = (ev: PointerEvent) => {
      const delta = startY - ev.clientY;
      if (Math.abs(delta) > 4) moved.current = true;
      height = Math.min(Math.max(startHeight + delta, PEEK_PX - 24), window.innerHeight * 0.92);
      setDragHeight(height);
    };
    const up = () => {
      stopListening();
      setDragHeight(null);
      if (moved.current) onSnapChange(nearestSnap(height));
    };

    stopListening();
    listeners.current = { move, up };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 lg:hidden flex flex-col bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.18)]"
      style={{
        height: dragHeight ?? snapHeight(snap),
        transition: dragHeight == null ? "height 280ms cubic-bezier(0.32,0.72,0,1)" : "none",
      }}
    >
      <div
        onPointerDown={startDrag}
        onClick={() => !moved.current && onSnapChange(NEXT[snap])}
        className="flex-shrink-0 flex justify-center pt-2.5 pb-2 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        role="button"
        aria-label="Resize panel"
      >
        <div className="w-10 h-1.5 rounded-full bg-gray-300" />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}
