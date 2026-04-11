"use client";

import { useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Loader2, LocateFixed, MapPinned } from "lucide-react";
import { reverseGeocode } from "../utils/reverseGeocode";
import { useLocation } from "../context/LocationContext";

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

// Fix Leaflet marker icon path resolution in Next.js bundles.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
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

type MapSelectorProps = {
  onDone?: () => void;
};

export default function MapSelector({ onDone }: MapSelectorProps) {
  const { latitude, longitude, setLocation } = useLocation();
  const [selected, setSelected] = useState<[number, number]>(
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [latitude as number, longitude as number]
      : DEFAULT_CENTER,
  );
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState("");

  const markerPosition = useMemo(() => selected, [selected]);

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
      const place = await reverseGeocode(lat, lon);
      setLocation(lat, lon, place);
      onDone?.();
    } catch {
      setError("Unable to confirm location. Please retry.");
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div className="space-y-4">
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
          <Marker position={markerPosition} />
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

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
