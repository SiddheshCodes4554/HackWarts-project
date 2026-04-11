import { Request, Response, Router } from "express";
import { getWeatherAdvisory } from "../agents/weatherAgent";

const weatherRouter = Router();

weatherRouter.get("/weather", async (req: Request, res: Response) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({
      error: "latitude and longitude query params are required numbers",
    });
  }

  try {
    const advisory = await getWeatherAdvisory(latitude, longitude);
    return res.status(200).json(advisory);
  } catch (error) {
    console.error("weather route fallback", error);
    return res.status(200).json({
      temperature: 30,
      rainfall: 0,
      humidity: 55,
      windSpeed: 4,
      advice: "Weather service is temporarily unavailable. Continue normal irrigation and monitor field moisture.",
      source: "fallback",
    });
  }
});

export { weatherRouter };
