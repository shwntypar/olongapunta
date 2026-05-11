"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
  padding?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: 120.712,
  latitude: 15.4828,
  zoom: 8,
};

const getActualTheme = (
  theme: "light" | "dark" | "system",
): "dark" | "light" => {
  if (theme === "system") {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return theme;
};

const getMapStyleForTheme = (theme: "light" | "dark" | "system"): string => {
  const actualTheme = getActualTheme(theme);

  return actualTheme === "dark"
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/light-v11";
};

export const useMapState = () => {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = (theme ?? "system") as "light" | "dark" | "system";

  const [viewState, setViewState] = useState<MapViewState>(() => ({
    ...DEFAULT_VIEW_STATE,
  }));
  const [styleUrl, setStyleUrl] = useState<string>(() =>
    getMapStyleForTheme(currentTheme),
  );
  const [isStyleReady, setIsStyleReady] = useState(false);
  const [mapRef, setMapRef] = useState<any>(null);

  const handleStyleChange = useCallback((newStyleUrl: string) => {
    setIsStyleReady(false);
    setStyleUrl(newStyleUrl);
  }, []);

  const handleMapLoad = useCallback((evt: any) => {
    const mapInstance = evt.target;
    setMapRef(mapInstance);
    setIsStyleReady(true);
  }, []);

  const handleMove = useCallback((evt: any) => {
    setViewState(evt.viewState as MapViewState);
  }, []);

  // Update map style when theme changes
  useEffect(() => {
    const newStyleUrl = getMapStyleForTheme(currentTheme);
    setStyleUrl(newStyleUrl);
  }, [theme]);

  // Listen for system theme changes when theme is set to "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const newStyleUrl = getMapStyleForTheme(theme);
      setStyleUrl(newStyleUrl);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  useEffect(() => {
    if (!mapRef) return;

    const markStyleReady = () => {
      setIsStyleReady(true);
    };

    if (typeof mapRef.isStyleLoaded === "function" && mapRef.isStyleLoaded()) {
      setIsStyleReady(true);
    }

    mapRef.on("style.load", markStyleReady);
    return () => {
      mapRef.off("style.load", markStyleReady);
    };
  }, [mapRef]);

  return {
    viewState,
    setViewState,
    styleUrl,
    isStyleReady,
    mapRef,
    handleStyleChange,
    handleMapLoad,
    handleMove,
  };
};

const getInitialAnimationTime = () => {
  const now = new Date();
  const currentMinutes = now.getMinutes();

  return 24 + currentMinutes / 60;
};

export const useAnimationState = () => {
  const initialTime = getInitialAnimationTime();
  const [animationTime, setAnimationTime] = useState(initialTime);
  const [localAnimationEnabled, setLocalAnimationEnabled] =
    useState<boolean>(false);
  const [timeOffset, setTimeOffset] = useState(initialTime);
  const [selectedHour, setSelectedHour] = useState(23);
  const [heartbeatScale, setHeartbeatScale] = useState(1);

  const animationRef = useRef<number | null>(null);
  const lastAnimationTimeRef = useRef<number>(initialTime);
  const isDraggingRef = useRef(false);

  return {
    animationTime,
    setAnimationTime,
    localAnimationEnabled,
    setLocalAnimationEnabled,
    timeOffset,
    setTimeOffset,
    selectedHour,
    setSelectedHour,
    heartbeatScale,
    setHeartbeatScale,
    animationRef,
    lastAnimationTimeRef,
    isDraggingRef,
  };
};
