"use client";

// The card shown when a place is selected on the map: everything known about
// it (address, hours, contacts, facts from OpenStreetMap, or zone/fare info
// for tricycle stands), plus Get Directions.

import { useEffect, useState } from "react";
import { Building2, Clock, Copy, ExternalLink, Globe, Mail, MapPin, Navigation, Phone, Utensils, X } from "lucide-react";
import { getDistanceMeters } from "../../application/geo";
import type { Place } from "../../domain/types";
import { approximateAddress } from "../../utils/geolocation";
import CategoryIcon from "../components/CategoryIcon";
import { categoryLabel, placeColor } from "../placeCategories";
import DetailRow from "./DetailRow";
import HoursSection from "./HoursSection";
import TransportStopInfo from "./TransportStopInfo";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Street address from OSM; otherwise an approximate one looked up for the card (clearly marked). */
function AddressRow({ place }: { place: Place }) {
  const known = place.details?.address;
  const [approx, setApprox] = useState<string | null | undefined>(undefined); // undefined = still looking

  useEffect(() => {
    if (known) return;
    let cancelled = false;
    void approximateAddress([place.lon, place.lat]).then((text) => {
      if (!cancelled) setApprox(text);
    });
    return () => {
      cancelled = true;
    };
  }, [known, place.lat, place.lon]);

  if (known) return <DetailRow icon={MapPin}>{known}</DetailRow>;
  return (
    <DetailRow icon={MapPin}>
      {approx === undefined ? (
        <span className="text-gray-400 animate-pulse">Finding the address…</span>
      ) : approx ? (
        <>
          {approx}
          <span className="block text-[11px] text-gray-400">Approximate — from the map location</span>
        </>
      ) : (
        <span className="text-gray-500">{place.where ?? place.details?.area ?? "No address on record"}</span>
      )}
    </DetailRow>
  );
}

function CoordinatesRow({ place }: { place: Place }) {
  const [copied, setCopied] = useState(false);
  const text = `${place.lat.toFixed(6)}, ${place.lon.toFixed(6)}`;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-[12px] text-gray-500">
      <span className="tabular-nums">{text}</span>
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => setCopied(true));
        }}
        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function PlaceDetailsCard({
  place,
  from,
  onClose,
  onGetDirections,
}: {
  place: Place;
  /** The trip origin / user's position, for "x km away" (straight line). */
  from?: number[] | null;
  onClose: () => void;
  onGetDirections: () => void;
}) {
  const d = place.details;
  const color = placeColor(place);
  const isOsm = !!d;
  const distanceKm = from ? getDistanceMeters(from, [place.lon, place.lat]) / 1000 : null;
  const subtitle = [categoryLabel(place.type), d?.brand, d?.ownership].filter(Boolean).join(" · ");
  const osmUrl = d ? `https://www.openstreetmap.org/${d.osm.type}/${d.osm.id}` : null;

  return (
    <div className="w-[300px] max-w-[85vw] bg-white text-gray-900 rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-3.5 border-b border-gray-100">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ backgroundColor: color }}>
          <CategoryIcon type={place.type} color="white" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-[15px] leading-tight text-gray-900">{place.name}</h3>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-500">{subtitle}</p>
          {/* A bare "near <barangay>" estimate is left to the address row below, which is more specific. */}
          {place.where && !(isOsm && place.where.startsWith("near ")) && <p className="mt-0.5 text-[11px] text-gray-500">{place.where}</p>}
          {distanceKm !== null && <p className="mt-0.5 text-[11px] text-gray-400">{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away (straight line)</p>}
        </div>
        <button onClick={onClose} className="p-1 -m-1 text-gray-400 hover:text-gray-900 transition-colors" aria-label="Close" title="Close">
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Details */}
      <div className="max-h-[min(32vh,300px)] sm:max-h-[min(50vh,420px)] overflow-y-auto px-3.5 py-2 divide-y divide-gray-100 scrollbar-thin scrollbar-thumb-gray-300">
        <div>
          {isOsm && <AddressRow place={place} />}
          {d?.openingHours && (
            <DetailRow icon={Clock}>
              <HoursSection raw={d.openingHours} />
            </DetailRow>
          )}
          {d?.phones.map((phone) => (
            <DetailRow key={phone} icon={Phone}>
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-blue-600 hover:underline">
                {phone}
              </a>
            </DetailRow>
          ))}
          {d?.website && (
            <DetailRow icon={Globe}>
              <a href={d.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                {hostOf(d.website)}
              </a>
            </DetailRow>
          )}
          {d?.facebook && (
            <DetailRow icon={Globe}>
              <a href={d.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Facebook page
              </a>
            </DetailRow>
          )}
          {d?.email && (
            <DetailRow icon={Mail}>
              <a href={`mailto:${d.email}`} className="text-blue-600 hover:underline break-all">
                {d.email}
              </a>
            </DetailRow>
          )}
          {d && d.cuisine.length > 0 && <DetailRow icon={Utensils}>{d.cuisine.join(", ")}</DetailRow>}
          {d?.operator && <DetailRow icon={Building2}>Operated by {d.operator}</DetailRow>}
          <TransportStopInfo place={place} />
        </div>

        {d?.description && <p className="py-2 text-[13px] text-gray-700">{d.description}</p>}

        {d && d.facts.length > 0 && (
          <div className="py-1">
            {d.facts.map((f) => (
              <DetailRow key={f.label} label={f.label}>
                {f.value}
              </DetailRow>
            ))}
          </div>
        )}

        {d && d.otherNames.length > 0 && <p className="py-2 text-[12px] text-gray-500">Also known as {d.otherNames.join(" · ")}</p>}

        <CoordinatesRow place={place} />
      </div>

      {/* Actions */}
      <div className="p-3 pt-2 border-t border-gray-100 space-y-2">
        <button
          onClick={onGetDirections}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-colors"
        >
          <Navigation className="h-3.5 w-3.5" strokeWidth={2.5} />
          Get Directions
        </button>
        {osmUrl && (
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>© OpenStreetMap contributors</span>
            <a href={osmUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-gray-500 hover:text-gray-800">
              View <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
