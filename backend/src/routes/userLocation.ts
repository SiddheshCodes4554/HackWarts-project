import { Request, Response, Router } from "express";

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
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Location save service is not configured");
  }

  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return;
  }

  const raw = await response.text();
  throw new Error(raw || `Supabase update failed: HTTP ${response.status}`);
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
