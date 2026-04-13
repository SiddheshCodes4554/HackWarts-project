import { Request, Response, Router } from "express";
import { User } from "../models/User";

const userLocationRouter = Router();

type LocationPayload = {
  userId?: string;
  lat?: number;
  lon?: number;
  district?: string;
  state?: string;
  village?: string;
  full_address?: string;
};

type RateWindow = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_PER_MINUTE = 30;
const WINDOW_MS = 60_000;
const requestWindows = new Map<string, RateWindow>();

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const current = requestWindows.get(key);

  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_PER_MINUTE) {
    return false;
  }

  current.count += 1;
  requestWindows.set(key, current);
  return true;
}

async function patchProfile(userId: string, payload: Record<string, unknown>): Promise<void> {
  const update = {
    name: typeof payload.name === "string" ? payload.name : undefined,
    land_area: typeof payload.land_area === "number" ? payload.land_area : undefined,
    primary_crop: typeof payload.primary_crop === "string" ? payload.primary_crop : undefined,
    location: {
      lat: typeof payload.latitude === "number" ? payload.latitude : typeof payload.lat === "number" ? payload.lat : undefined,
      lon: typeof payload.longitude === "number" ? payload.longitude : typeof payload.lon === "number" ? payload.lon : undefined,
      district: typeof payload.district === "string" ? payload.district : undefined,
      state: typeof payload.state === "string" ? payload.state : undefined,
    },
    updatedAt: new Date(),
  };

  await User.updateOne({ email: userId }, { $set: update }, { upsert: true });
}

userLocationRouter.post("/user/location", async (req: Request, res: Response) => {
  const payload = (req.body ?? {}) as LocationPayload;
  const userId = toText(payload.userId);

  if (!userId) {
    return res.status(400).json({
      error: "userId is required",
    });
  }

  if (!isValidCoordinate(payload.lat, -90, 90) || !isValidCoordinate(payload.lon, -180, 180)) {
    return res.status(400).json({
      error: "lat/lon must be valid coordinates",
    });
  }

  const requester = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const limiterKey = `${String(requester)}:${userId}`;

  if (!checkRateLimit(limiterKey)) {
    return res.status(429).json({
      error: "Too many location updates. Please retry in a minute.",
    });
  }

  const district = toText(payload.district);
  const state = toText(payload.state);
  const village = toText(payload.village);
  const fullAddress = toText(payload.full_address);

  const updatePayload: Record<string, unknown> = {
    latitude: payload.lat,
    longitude: payload.lon,
    location_name: fullAddress || [village, district, state].filter(Boolean).join(", "),
    district,
    state,
    village,
    updated_at: new Date().toISOString(),
  };

  try {
    try {
      await patchProfile(userId, updatePayload);
    } catch {
      // Fallback for schemas that do not yet have district/state/village columns.
      await patchProfile(userId, {
        latitude: payload.lat,
        longitude: payload.lon,
        location_name: updatePayload.location_name,
        updated_at: updatePayload.updated_at,
      });
    }

    return res.status(200).json({
      ok: true,
      location: {
        lat: payload.lat,
        lon: payload.lon,
        district,
        state,
        village,
        full_address: updatePayload.location_name,
      },
    });
  } catch (error) {
    console.error("User location update failed", error);

    return res.status(503).json({
      error: "Unable to persist user location right now",
    });
  }
});

export { userLocationRouter };
