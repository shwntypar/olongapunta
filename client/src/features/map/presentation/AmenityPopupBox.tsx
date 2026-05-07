"use client";

import React from 'react';

interface AmenityDetailBoxProps {
  place: any;
  onClose: () => void;
  onGetDirections: (place: any) => void;
}

export default function AmenityPopupBox({ place, onClose, onGetDirections }: AmenityDetailBoxProps) {
  if (!place) return null;

  return (
    /* Added w-80 (320px) and min-w-max to prevent squishing */
    <div className="w-80 min-w-[20rem] bg-white rounded-2xl shadow-2xl p-5 border border-gray-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
      
      {/* Header with Title and Close Button */}
      <div className="flex justify-between items-start gap-2">
        <div>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">
            {place.type}
          </span>
          <h2 className="text-lg font-bold text-gray-900 mt-2 leading-tight">
            {place.name}
          </h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
  
      {/* Footer with Button */}
      <div className="pt-2">
        <button 
          onClick={() => onGetDirections(place)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md shadow-blue-200"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          Get Directions
        </button>
      </div>
    </div>
  );
}