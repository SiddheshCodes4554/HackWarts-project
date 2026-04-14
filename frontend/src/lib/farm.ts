import { area as turfArea, centroid, polygon } from "@turf/turf";

export type FarmBoundaryPoint = [number, number];

export type FarmCenter = {
  lat: number;
  lon: number;
};

export type FarmInsights = {
  weather: string[];
  soil: string[];
  recommendations: string[];
};

export type FarmRecord = {
  _id?: string;
  userId: string;
  name: string;
  boundary: FarmBoundaryPoint[];
  area: number;
  center: FarmCenter;
  insights?: FarmInsights;
  createdAt?: string;
  updatedAt?: string;
};

export type FarmDraft = {
  boundary: FarmBoundaryPoint[];
  areaSqMeters: number;
  acres: number;
  hectares: number;
  center: FarmCenter;
};

export const DEFAULT_FARM_CENTER: FarmCenter = {
  lat: 21.1458,
  lon: 79.0882,
};

const ACRE_IN_SQ_METERS = 4046.8564224;

function toLatLngRing(boundary: FarmBoundaryPoint[]): [number, number][] {
  const ring = boundary.map(([lat, lon]) => [lon, lat] as [number, number]);
  if (ring.length > 0) {
    ring.push(ring[0]);
  }

  return ring;
}

export function calculateFarmDraft(boundary: FarmBoundaryPoint[]): FarmDraft {
  if (boundary.length < 3) {
    const fallbackCenter = boundary[0]
      ? { lat: boundary[0][0], lon: boundary[0][1] }
      : DEFAULT_FARM_CENTER;

    return {
      boundary,
      areaSqMeters: 0,
      acres: 0,
      hectares: 0,
      center: fallbackCenter,
    };
  }

  const shape = polygon([toLatLngRing(boundary)]);
  const areaSqMeters = turfArea(shape);
  const centerCoordinates = centroid(shape).geometry.coordinates;

  return {
    boundary,
    areaSqMeters,
    acres: areaSqMeters / ACRE_IN_SQ_METERS,
    hectares: areaSqMeters / 10000,
    center: {
      lat: centerCoordinates[1],
      lon: centerCoordinates[0],
    },
  };
}

function backendBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    ""
  ).replace(/\/$/, "");
}

export async function fetchFarmByUserId(userId: string): Promise<FarmRecord | null> {
  if (!userId) {
    return null;
  }

  const response = await fetch(`/api/farm?userId=${encodeURIComponent(userId)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Unable to load farm");
  }

  return (await response.json()) as FarmRecord;
}

export async function saveFarmRecord(payload: {
  userId: string;
  name?: string;
  boundary: FarmBoundaryPoint[];
  area: number;
  center: FarmCenter;
  insights?: FarmInsights;
}): Promise<FarmRecord> {
  const response = await fetch(`/api/farm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: payload.userId,
      name: payload.name,
      boundary: payload.boundary,
      area: payload.area,
      center: payload.center,
      insights: payload.insights,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as { farm?: FarmRecord; error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "Unable to save farm");
  }

  if (!body.farm) {
    throw new Error("Farm save response was empty");
  }

  return body.farm;
}

export function getBackendBaseUrlForClient(): string {
  return backendBaseUrl();
}
