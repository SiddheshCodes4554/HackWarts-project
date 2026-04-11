import { Request, Response, Router } from "express";
import { getDashboardData } from "../services/dashboardService";

const dashboardRouter = Router();

dashboardRouter.get("/dashboard", async (req: Request, res: Response) => {
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
    return res.status(502).json({
      error: "Unable to generate dashboard intelligence right now",
    });
  }
});

export { dashboardRouter };
