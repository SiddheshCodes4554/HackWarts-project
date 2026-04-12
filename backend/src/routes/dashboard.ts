import { Request, Response, Router } from "express";
import { getDashboardData } from "../services/dashboardService";
import { generateFarmInsights } from "../services/farmIntelligenceService";

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

async function handleFarmIntelligenceRequest(req: Request, res: Response) {
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
    const intelligence = await generateFarmInsights({
      latitude,
      longitude,
      placeName,
    });

    return res.status(200).json(intelligence);
  } catch (error) {
    console.error("Farm intelligence route error", error);
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      location: {
        district: "Unknown",
        latitude,
        longitude,
      },
      top_crops: [
        { name: "Wheat", price: 2500, change_percent: 2, trend: "stable", frequency: 30 },
        { name: "Rice", price: 2800, change_percent: 3, trend: "rising", frequency: 28 },
      ],
      soil_analysis: {
        soil_score: 70,
        ph: 6.8,
        nitrogen: 0.18,
        organicCarbon: 0.95,
        acidity: "Neutral",
        issues: [],
        recommendations: ["Maintain current soil management practices"],
      },
      weather_impact: {
        temperature_optimal: true,
        rainfall_adequate: true,
        suitability_score: 78,
        risk_alerts: ["No immediate weather risks"],
        recommendations: ["Monitor monsoon timing for irrigation planning"],
      },
      best_crop_recommendation: {
        crop: "Wheat",
        reason: "Based on regional market trends and soil conditions",
        profit_potential: 10,
        season: "Current",
        confidence: 65,
      },
      market_opportunities: [
        { crop: "Rice", price_trend: "↑ 3%", potential_profit: "₹2800 per quintal" },
      ],
      actionable_insights: [
        {
          title: "🌾 Farm Intelligence Status",
          description: "Generating comprehensive insights for your farm...",
          icon: "seedling",
          priority: "high",
        },
      ],
      summary: "Farm intelligence is being generated. Please try again shortly.",
    });
  }
}

dashboardRouter.get("/farm-intelligence", handleFarmIntelligenceRequest);

export { dashboardRouter };
