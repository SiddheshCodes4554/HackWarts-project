import { Request, Response, Router } from "express";
import { getSoilProfile } from "../services/soilService";
import { getWeatherAdvisory } from "../agents/weatherAgent";
import { Farm, FarmBoundaryPoint } from "../models/Farm";

const farmRouter = Router();

type FarmPayload = {
  userId?: string;
  name?: string;
  boundary?: FarmBoundaryPoint[];
  center?: { lat?: number; lon?: number };
  area?: number;
  insights?: {
    weather?: string[];
    soil?: string[];
    recommendations?: string[];
  };
};

function normalizeUserId(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidPoint(point: unknown): point is FarmBoundaryPoint {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    typeof point[0] === "number" &&
    typeof point[1] === "number" &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1])
  );
}

function sanitizeBoundary(boundary: unknown): FarmBoundaryPoint[] {
  if (!Array.isArray(boundary)) {
    return [];
  }

  return boundary.filter(isValidPoint);
}

function normalizeCenter(center: unknown, fallback: FarmBoundaryPoint[]): { lat: number; lon: number } {
  if (center && typeof center === "object") {
    const lat = typeof (center as { lat?: unknown }).lat === "number" ? (center as { lat: number }).lat : NaN;
    const lon = typeof (center as { lon?: unknown }).lon === "number" ? (center as { lon: number }).lon : NaN;

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  const average = fallback.reduce(
    (accumulator, point) => {
      accumulator.lat += point[0];
      accumulator.lon += point[1];
      return accumulator;
    },
    { lat: 0, lon: 0 },
  );

  const count = Math.max(1, fallback.length);
  return { lat: average.lat / count, lon: average.lon / count };
}

async function buildInsights(lat: number, lon: number): Promise<{
  weather: string[];
  soil: string[];
  recommendations: string[];
}> {
  const [weather, soil] = await Promise.all([
    getWeatherAdvisory(lat, lon),
    getSoilProfile(lat, lon),
  ]);

  const weatherInsights = [
    `Weather: ${weather.advice}`,
    `Humidity ${weather.humidity}% and rainfall ${weather.rainfall} mm are being tracked for boundary-specific planning.`,
  ];

  const soilInsights = [
    `Soil pH ${soil.ph} with ${soil.soilType.toLowerCase()} conditions.`,
    soil.recommendation,
  ];

  const recommendations = [
    weather.rainfall >= 2 ? "Delay irrigation until rain window passes." : "Irrigation can proceed with normal monitoring.",
    soil.nitrogen < 0.15 ? "Apply nitrogen-rich fertilizer in split doses." : "Maintain current nutrient schedule and monitor soil moisture.",
  ];

  return {
    weather: weatherInsights,
    soil: soilInsights,
    recommendations,
  };
}

farmRouter.get("/farm", async (req: Request, res: Response) => {
  try {
    const userId = normalizeUserId(req.query.userId);
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const farm = await Farm.findOne({ userId }).lean();
    if (!farm) {
      return res.status(404).json({ error: "Farm not found" });
    }

    return res.status(200).json(farm);
  } catch (error) {
    console.error("farm get error", error);
    return res.status(500).json({ error: "Unable to load farm" });
  }
});

farmRouter.get("/farm/latest", async (req: Request, res: Response) => {
  try {
    const userId = normalizeUserId(req.query.userId);
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const farm = await Farm.findOne({ userId }).sort({ updatedAt: -1 }).lean();
    if (!farm) {
      return res.status(404).json({ error: "Farm not found" });
    }

    return res.status(200).json(farm);
  } catch (error) {
    console.error("farm latest error", error);
    return res.status(500).json({ error: "Unable to load latest farm" });
  }
});

farmRouter.post("/farm", async (req: Request, res: Response) => {
  try {
    const payload = (req.body ?? {}) as FarmPayload;
    const userId = normalizeUserId(payload.userId);
    const boundary = sanitizeBoundary(payload.boundary);

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (boundary.length < 3) {
      return res.status(400).json({ error: "boundary must contain at least 3 polygon points" });
    }

    const center = normalizeCenter(payload.center, boundary);
    const existingInsights = payload.insights ?? { weather: [], soil: [], recommendations: [] };
    const liveInsights = await buildInsights(center.lat, center.lon);

    const doc = await Farm.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "My Farm",
          boundary,
          area: typeof payload.area === "number" && Number.isFinite(payload.area) ? payload.area : 0,
          center,
          insights: {
            weather: [...liveInsights.weather, ...(existingInsights.weather ?? [])].slice(0, 5),
            soil: [...liveInsights.soil, ...(existingInsights.soil ?? [])].slice(0, 5),
            recommendations: [...liveInsights.recommendations, ...(existingInsights.recommendations ?? [])].slice(0, 5),
          },
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true },
    ).lean();

    return res.status(200).json({
      success: true,
      farm: doc,
    });
  } catch (error) {
    console.error("farm save error", error);
    return res.status(500).json({ error: "Unable to save farm boundary" });
  }
});

export { farmRouter };
