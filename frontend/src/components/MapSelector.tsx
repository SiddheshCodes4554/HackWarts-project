"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Loader2, LocateFixed, MapPinned } from "lucide-react";
import { reverseGeocodeStructured, StructuredLocation } from "../utils/reverseGeocode";
import { useLocation } from "../context/LocationContext";
import { LocationSearch, LocationSuggestion } from "./LocationSearch";

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

// Use explicit icon URLs to avoid bundle/path issues in production deployments.
const defaultMarkerIcon = L.icon({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click: (event) => {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom(), { animate: true });
  return null;
}

function DraggableMarker({
  position,
  onDragEnd,
}: {
  position: [number, number];
  onDragEnd: (lat: number, lon: number) => void;
}) {
  return (
    <Marker
      position={position}
      icon={defaultMarkerIcon}
      draggable
      eventHandlers={{
        dragend: (event) => {
          const latlng = event.target.getLatLng();
          onDragEnd(latlng.lat, latlng.lng);
        },
      }}
    />
  );
}

type MapSelectorProps = {
  onDone?: () => void;
  onLocationConfirmed?: (location: StructuredLocation) => Promise<void> | void;
};

export default function MapSelector({ onDone, onLocationConfirmed }: MapSelectorProps) {
  const { latitude, longitude, setLocation } = useLocation();
  const [selected, setSelected] = useState<[number, number]>(
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [latitude as number, longitude as number]
      : DEFAULT_CENTER,
  );
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<StructuredLocation | null>(null);
  const [error, setError] = useState("");

  const markerPosition = useMemo(() => selected, [selected]);

  useEffect(() => {
    let cancelled = false;

    const updateAddress = async () => {
      setLocationLoading(true);
      const [lat, lon] = selected;
      const resolved = await reverseGeocodeStructured(lat, lon);

      if (!cancelled) {
        setSelectedAddress(resolved);
        setLocationLoading(false);
      }
    };

    void updateAddress();

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not available on this device.");
      return;
    }

    setGpsLoading(true);
    setError("");

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 60000,
        });
      });

      setSelected([position.coords.latitude, position.coords.longitude]);
    } catch {
      setError("Location access denied. Please select location on map.");
      setSelected(DEFAULT_CENTER);
    } finally {
      setGpsLoading(false);
    }
  };

  const confirmLocation = async () => {
    setConfirmLoading(true);
    setError("");

    try {
      const [lat, lon] = selected;
      const resolved = selectedAddress ?? (await reverseGeocodeStructured(lat, lon));
      setLocation(lat, lon, resolved.full_address);
      await onLocationConfirmed?.(resolved);
      onDone?.();
    } catch {
      setError("Unable to confirm location. Please retry.");
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <LocationSearch
        onSelect={(suggestion: LocationSuggestion) => {
          setSelected([suggestion.lat, suggestion.lon]);
        }}
      />

      <div className="h-[320px] overflow-hidden rounded-2xl border border-slate-200">
        <MapContainer
          center={markerPosition}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={(lat, lon) => setSelected([lat, lon])} />
          <MapRecenter center={markerPosition} />
          <DraggableMarker position={markerPosition} onDragEnd={(lat, lon) => setSelected([lat, lon])} />
        </MapContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={gpsLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          📍 Use My Location
        </button>

        <button
          type="button"
          onClick={confirmLocation}
          disabled={confirmLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-lime-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {confirmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />}
          Confirm Location
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Selected: {selected[0].toFixed(4)}, {selected[1].toFixed(4)}
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        {locationLoading || !selectedAddress
          ? "Resolving address..."
          : `Village: ${selectedAddress.village || "-"} | District: ${selectedAddress.district || "-"} | State: ${selectedAddress.state || "-"}`}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
