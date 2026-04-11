import { Request, Response, Router } from "express";
import { getDashboardData } from "../services/dashboardService";

const dashboardRouter = Router();

async function handleDashboardRequest(req: Request, res: Response) {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const placeName =
    typeof req.query.placeName === "string" && req.query.placeName.trim()
      ? req.query.placeName.trim()
      : "Nagpur, Maharashtra";

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({
      error: "latitude and longitude query params are required numbers",
    });
  }

  try {
    const data = await getDashboardData({
      latitude,
      longitude,
      placeName,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error("Dashboard route error", error);
    return res.status(200).json({
      weather: {
        current: {
          temperature: 29,
          humidity: 58,
          windSpeed: 4,
          rainProbability: 22,
          icon: "01d",
          description: "Fallback weather",
        },
        forecast: [],
      },
      crops: {
        recommendations: [],
        summary: "Crop insights are temporarily unavailable.",
      },
      market: {
        markets: [],
        bestMarket: "--",
        recommendation: "Market recommendation will appear shortly.",
        signal: "SELL",
        trend: [],
      },
      finance: {
        schemes: [],
        advice: "Finance insights are temporarily unavailable.",
      },
      soil: {
        ph: 6.8,
        nitrogen: 0.18,
        organicCarbon: 0.95,
        soilType: "Balanced",
        recommendation: "Maintain balanced nutrients and moisture.",
        healthScore: 72,
      },
      insights: [
        "Dashboard is serving fallback intelligence while upstream services recover.",
      ],
      warning: "Unable to generate full dashboard intelligence right now.",
    });
  }
}

dashboardRouter.get("/dashboard", handleDashboardRequest);
dashboardRouter.get("/dashboard/data", handleDashboardRequest);

export { dashboardRouter };
