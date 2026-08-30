"use client";

import React from "react";

interface AmenityPopupBoxProps {
  place: {
    name: string;
    type: string;
    lat: number;
    lon: number;
  };
  onClose: () => void;
  onGetDirections: () => void;
}

export default function AmenityPopupBox({
  place,
  onClose,
  onGetDirections,
}: AmenityPopupBoxProps) {
  return (
    <div className="bg-white text-gray-900 rounded-xl shadow-xl border border-gray-200 p-4 max-w-xs transition-all duration-200">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="font-extrabold text-sm text-gray-900 truncate max-w-[180px]">
            {place.name}
          </h3>
          <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 mt-1 bg-gray-100 text-gray-500 border border-gray-200 rounded-md">
            {place.type?.replace("_", " ")}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-900 transition-colors"
          title="Close Popup"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onGetDirections}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Get Directions
        </button>
      </div>
    </div>
  );
}
