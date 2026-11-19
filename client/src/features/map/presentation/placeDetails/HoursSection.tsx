// Opening hours: "Open now · Closes 10:00 PM", with the weekly schedule on tap.

import { useState } from "react";
import { manilaNow, openStatus, parseOpeningHours, scheduleLines } from "../../domain/openingHours";

export default function HoursSection({ raw }: { raw: string }) {
  const [expanded, setExpanded] = useState(false);
  const [now] = useState(manilaNow); // read once when the card opens
  const week = parseOpeningHours(raw);

  if (!week) return <p className="text-gray-700">{raw}</p>;

  const status = openStatus(week, now);
  const lines = scheduleLines(week);
  return (
    <div>
      <button onClick={() => setExpanded((v) => !v)} className="text-left w-full" aria-expanded={expanded}>
        <span className={`font-bold ${status.open ? "text-emerald-600" : "text-red-600"}`}>{status.open ? "Open now" : "Closed"}</span>
        <span className="text-gray-600"> · {status.detail}</span>
        {lines.length > 1 || lines[0]?.[0] !== "Every day" ? (
          <span className="ml-1 text-[11px] font-semibold text-blue-600">{expanded ? "Hide" : "Hours"}</span>
        ) : null}
      </button>
      {(expanded || lines.length === 1) && (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          {lines.map(([days, hours]) => (
            <div key={days} className="contents">
              <dt className="text-gray-500">{days}</dt>
              <dd className="text-gray-800">{hours}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
