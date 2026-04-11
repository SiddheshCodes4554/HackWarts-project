import { Request, Response, Router } from "express";
import { getMarketIntelligence } from "../services/marketIntelligence";
import { addMarketAlertSubscription, listMarketAlertSubscriptions } from "../services/marketAlerts";
import { AgentContext } from "../utils/types";

const marketRouter = Router();

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

marketRouter.get("/market-intelligence", async (req: Request, res: Response) => {
  try {
    const message = typeof req.query.message === "string" ? req.query.message : "market price";
    const latitude = toNumber(req.query.latitude, NaN);
    const longitude = toNumber(req.query.longitude, NaN);
    const locale = typeof req.query.locale === "string" ? req.query.locale : undefined;

    const context: AgentContext = {
      message,
      locale,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
      timestamp: new Date().toISOString(),
    };

    const result = await getMarketIntelligence(context);
    return res.status(200).json(result);
  } catch (error) {
    console.error("market-intelligence route error", error);
    return res.status(500).json({ error: "Unable to fetch market intelligence" });
  }
});

marketRouter.post("/market-alerts", (req: Request, res: Response) => {
  try {
    const commodity = typeof req.body?.commodity === "string" ? req.body.commodity.trim() : "";
    const contact = typeof req.body?.contact === "string" ? req.body.contact.trim() : "";
    const targetPrice = toNumber(req.body?.targetPrice, NaN);

    if (!commodity || !contact || !Number.isFinite(targetPrice)) {
      return res.status(400).json({ error: "commodity, contact, and targetPrice are required" });
    }

    const subscription = addMarketAlertSubscription({ commodity, contact, targetPrice });
    return res.status(201).json(subscription);
  } catch (error) {
    console.error("market-alerts route error", error);
    return res.status(500).json({ error: "Unable to save market alert" });
  }
});

marketRouter.get("/market-alerts", (_req: Request, res: Response) => {
  return res.status(200).json({ subscriptions: listMarketAlertSubscriptions() });
});

export { marketRouter };
