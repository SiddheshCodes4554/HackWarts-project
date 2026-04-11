"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { reverseGeocode } from "../utils/reverseGeocode";

type LocationState = {
  latitude: number | null;
  longitude: number | null;
  placeName: string;
};

type LocationContextValue = {
  latitude: number | null;
  longitude: number | null;
  placeName: string;
  isDetecting: boolean;
  setLocation: (lat: number, lon: number, placeName: string) => void;
  getLocation: () => LocationState;
  detectCurrentLocation: () => Promise<void>;
};

const DEFAULT_LOCATION: LocationState = {
  latitude: 21.1458,
  longitude: 79.0882,
  placeName: "Nagpur, Maharashtra",
};

const STORAGE_KEY = "farmease_location";

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState<LocationState>(DEFAULT_LOCATION);
  const [isDetecting, setIsDetecting] = useState(false);

  const setLocation = useCallback((lat: number, lon: number, placeName: string) => {
    const nextLocation: LocationState = {
      latitude: lat,
      longitude: lon,
      placeName,
    };

    setLocationState(nextLocation);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLocation));
    }
  }, []);

  const getLocation = useCallback(() => location, [location]);

  const detectCurrentLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocation(DEFAULT_LOCATION.latitude as number, DEFAULT_LOCATION.longitude as number, DEFAULT_LOCATION.placeName);
      return;
    }

    setIsDetecting(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 60000,
        });
      });

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const placeName = await reverseGeocode(lat, lon);

      setLocation(lat, lon, placeName);
    } catch (error) {
      setLocation(DEFAULT_LOCATION.latitude as number, DEFAULT_LOCATION.longitude as number, DEFAULT_LOCATION.placeName);
    } finally {
      setIsDetecting(false);
    }
  }, [setLocation]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as LocationState;
        if (
          Number.isFinite(parsed.latitude) &&
          Number.isFinite(parsed.longitude) &&
          typeof parsed.placeName === "string" &&
          parsed.placeName.trim()
        ) {
          setLocationState(parsed);
          return;
        }
      } catch (error) {
        console.error("Failed to parse saved location", error);
      }
    }

    void detectCurrentLocation();
  }, [detectCurrentLocation]);

  const value = useMemo<LocationContextValue>(
    () => ({
      latitude: location.latitude,
      longitude: location.longitude,
      placeName: location.placeName,
      isDetecting,
      setLocation,
      getLocation,
      detectCurrentLocation,
    }),
    [location, isDetecting, setLocation, getLocation, detectCurrentLocation],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error("useLocation must be used inside a LocationProvider");
  }

  return context;
}
