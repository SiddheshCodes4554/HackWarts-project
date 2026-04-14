"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FeatureGroup, MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import { LocateFixed, SquarePen, Trash2 } from "lucide-react";
import type { FarmBoundaryPoint, FarmDraft } from "../lib/farm";
import { calculateFarmDraft, DEFAULT_FARM_CENTER } from "../lib/farm";

const DEFAULT_ZOOM = 15;
const EMPTY_BOUNDARY: FarmBoundaryPoint[] = [];

type FarmMapProps = {
  initialBoundary?: FarmBoundaryPoint[];
  initialCenter?: [number, number];
  initialZoom?: number;
  editable?: boolean;
  onChange?: (draft: FarmDraft) => void;
};

type ViewSyncProps = {
  center: [number, number];
};

function ViewSync({ center }: ViewSyncProps) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function BoundarySync({ boundary }: { boundary: FarmBoundaryPoint[] }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (boundary.length < 3 || hasFittedRef.current) {
      return;
    }

    const polygon = L.polygon(boundary.map(([lat, lon]) => [lat, lon] as [number, number]));
    map.fitBounds(polygon.getBounds(), { padding: [28, 28] });
    hasFittedRef.current = true;
  }, [boundary, map]);

  return null;
}

function DrawControl({
  editable,
  featureGroupRef,
  onBoundaryChange,
}: {
  editable: boolean;
  featureGroupRef: React.RefObject<L.FeatureGroup | null>;
  onBoundaryChange: (boundary: FarmBoundaryPoint[]) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!editable || !featureGroupRef.current) {
      return;
    }

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: "#15803d",
            weight: 3,
            fillOpacity: 0.18,
          },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: {
        featureGroup: featureGroupRef.current,
        remove: true,
      },
    });

    const extractBoundary = (layer: L.Layer) => {
      if (!(layer instanceof L.Polygon)) {
        return;
      }

      const latLngs = layer.getLatLngs();
      const firstRing = Array.isArray(latLngs[0]) ? (latLngs[0] as L.LatLng[]) : [];
      const nextBoundary = firstRing.map((point) => [point.lat, point.lng] as FarmBoundaryPoint);

      if (nextBoundary.length >= 3) {
        onBoundaryChange(nextBoundary);
      }
    };

    const handleCreated = (event: L.LeafletEvent) => {
      const createdEvent = event as L.DrawEvents.Created;
      const featureGroup = featureGroupRef.current;
      if (!featureGroup) {
        return;
      }

      featureGroup.clearLayers();
      featureGroup.addLayer(createdEvent.layer);
      extractBoundary(createdEvent.layer);
    };

    const handleEdited = (event: L.LeafletEvent) => {
      const editedEvent = event as L.DrawEvents.Edited;
      editedEvent.layers.eachLayer((layer) => extractBoundary(layer));
    };

    const handleDeleted = () => {
      onBoundaryChange(EMPTY_BOUNDARY);
    };

    map.addControl(drawControl);
    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);
    map.on(L.Draw.Event.DELETED, handleDeleted);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
      map.off(L.Draw.Event.DELETED, handleDeleted);
      map.removeControl(drawControl);
    };
  }, [editable, featureGroupRef, map, onBoundaryChange]);

  return null;
}

export default function FarmMap({
  initialBoundary = EMPTY_BOUNDARY,
  initialCenter,
  initialZoom = DEFAULT_ZOOM,
  editable = true,
  onChange,
}: FarmMapProps) {
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);
  const [boundary, setBoundary] = useState<FarmBoundaryPoint[]>(initialBoundary);
  const [center, setCenter] = useState<[number, number]>(
    initialCenter ?? [DEFAULT_FARM_CENTER.lat, DEFAULT_FARM_CENTER.lon],
  );

  useEffect(() => {
    setBoundary(initialBoundary);
  }, [initialBoundary]);

  const draft = useMemo(() => calculateFarmDraft(boundary), [boundary]);

  useEffect(() => {
    const featureGroup = featureGroupRef.current;
    if (!featureGroup) {
      return;
    }

    featureGroup.clearLayers();

    if (boundary.length >= 3) {
      const layer = L.polygon(
        boundary.map(([lat, lon]) => [lat, lon] as [number, number]),
        {
          color: "#15803d",
          weight: 3,
          fillColor: "#86efac",
          fillOpacity: 0.22,
        },
      );

      featureGroup.addLayer(layer);
    }
  }, [boundary]);

  useEffect(() => {
    onChange?.(draft);
  }, [draft, onChange]);

  const centerOnGps = async () => {
    if (!navigator.geolocation) {
      return;
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
    }).catch(() => null);

    if (!position) {
      return;
    }

    setCenter([position.coords.latitude, position.coords.longitude]);
  };

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-lime-100 bg-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute left-4 right-4 top-4 z-500 flex items-start justify-between gap-3">
        <div className="pointer-events-none rounded-2xl bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-lime-100 backdrop-blur">
          Draw a single farm polygon. Tap a vertex, trace the boundary, and edit it if needed.
        </div>
        {editable ? (
          <button
            type="button"
            onClick={centerOnGps}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-lime-100 transition hover:bg-white"
          >
            <LocateFixed className="h-4 w-4 text-lime-700" />
            Center GPS
          </button>
        ) : null}
      </div>

      {editable ? (
        <div className="absolute bottom-4 left-4 z-500 flex gap-2">
          <button
            type="button"
            onClick={() => setBoundary(EMPTY_BOUNDARY)}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm ring-1 ring-rose-100 transition hover:bg-white"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm">
            <SquarePen className="h-4 w-4" />
            Polygon only
          </div>
        </div>
      ) : null}

      <MapContainer
        center={center}
        zoom={initialZoom}
        scrollWheelZoom
        zoomControl={false}
        className="h-105 w-full sm:h-125"
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ViewSync center={center} />
        <BoundarySync boundary={boundary} />
        <DrawControl
          editable={editable}
          featureGroupRef={featureGroupRef}
          onBoundaryChange={setBoundary}
        />

        <FeatureGroup ref={featureGroupRef} />
      </MapContainer>
    </div>
  );
}
