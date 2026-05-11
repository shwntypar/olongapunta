"use client";
import React, { useState } from 'react';
import { getDistanceMeters } from '../application/getDirections';

// Added Travel Modes
export type TravelMode = 'walking' | 'cycling' | 'driving';

interface SidebarProps {
  places: any[];
  userLocation: number[] | null;
  origin: { name: string; coords: number[] } | null;
  destination: any | null;
  onNavigate: (place: any, mode: TravelMode) => void;
  onSelectOriginMode: () => void; // To tell map we are picking a start point
}

export default function Sidebar({ places, userLocation, origin, destination, onNavigate, onSelectOriginMode }: SidebarProps) {
  const [mode, setMode] = useState<TravelMode>('driving');

  const placesWithDistance = places.map(place => {
    const startPos = origin ? origin.coords : userLocation || [0,0];
    const distance = getDistanceMeters(startPos, [parseFloat(place.lon), parseFloat(place.lat)]);
    return { ...place, distance };
  }).sort((a, b) => a.distance - b.distance);

  return (
    <div className="absolute left-0 top-0 h-full w-80 bg-white shadow-2xl z-20 flex flex-col border-r border-gray-200">
      {/* 🟢 NEW: TRIP PLANNER SECTION */}
      <div className="p-4 bg-gray-900 text-white space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <span className="text-blue-400">●</span> Trip Planner
        </h2>

        <div className="space-y-2">
          {/* Origin Selector */}
          <button 
            onClick={onSelectOriginMode}
            className={`w-full text-left p-2 rounded border text-sm transition-all ${!origin ? 'border-dashed border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-800'}`}
          >
            <div className="text-[10px] uppercase text-gray-400 font-bold">Starting From</div>
            <div className="truncate">{origin ? origin.name : "Click map to set start..."}</div>
          </button>

          {/* Destination Display */}
          <div className="w-full text-left p-2 rounded border border-gray-700 bg-gray-800 text-sm opacity-80">
            <div className="text-[10px] uppercase text-gray-400 font-bold">Going To</div>
            <div className="truncate">{destination ? destination.name : "Select a place below..."}</div>
          </div>
        </div>

        {/* 🟢 MULTIMODAL SELECTOR */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          {(['walking', 'cycling', 'driving'] as TravelMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1 text-xs capitalize rounded transition-all ${mode === m ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {m === 'cycling' ? 'Motorcycle' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Places List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {placesWithDistance.map((place, index) => (
          <div key={place.id || index} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-md transition-all">
            <h3 className="font-bold text-gray-800">{place.name}</h3>
            <p className="text-xs text-gray-500 mb-3">{(place.distance / 1000).toFixed(1)}km from start</p>
            
            <button
              disabled={!origin}
              onClick={() => onNavigate(place, mode)}
              className={`w-full py-2 rounded-lg font-semibold flex justify-center items-center gap-2 transition-all ${!origin ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              Navigate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}