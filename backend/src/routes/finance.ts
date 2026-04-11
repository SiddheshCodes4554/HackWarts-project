import { Request, Response, Router } from "express";
import { getFinancialAdvice } from "../agents/financeAgent";
import { FinancialUserProfile } from "../utils/types";

const financeRouter = Router();

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function toNumber(value: unknown, fallback = Number.NaN): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function inferIncomeLevel(source: Record<string, unknown>): string {
  const explicit = toText(source.incomeLevel ?? source.income_level);
  if (explicit) {
    return explicit;
  }

  const landArea = toNumber(source.landArea ?? source.land_area);
  if (!Number.isFinite(landArea)) {
    return "medium";
  }

  if (landArea <= 2) {
    return "low";
  }

  if (landArea <= 5) {
    return "medium";
  }

  return "high";
}

function buildProfile(source: Record<string, unknown>): FinancialUserProfile {
  const landArea = toNumber(source.landArea ?? source.land_area, 0);

  return {
    landOwned: toBoolean(source.landOwned ?? source.land_owned, landArea > 0),
    cropType: toText(source.cropType ?? source.primary_crop ?? source.crop),
    location: toText(source.location ?? source.location_name ?? source.placeName, "India"),
    incomeLevel: inferIncomeLevel(source),
  };
}

function parseRequest(req: Request): { profile: FinancialUserProfile; language: string } {
  const body = (req.method === "POST" ? (req.body ?? {}) : {}) as Record<string, unknown>;
  const query = req.query as Record<string, unknown>;
  const source = { ...query, ...body };

  return {
    profile: buildProfile(source),
    language: toText(source.language, "English"),
  };
}

financeRouter.get("/financial-advice", async (req: Request, res: Response) => {
  try {
    const { profile, language } = parseRequest(req);
    const advice = await getFinancialAdvice(profile, language);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).json(advice);
  } catch (error) {
    console.error("financial-advice route error", error);
    return res.status(500).json({ error: "Unable to fetch financial advice" });
  }
});

financeRouter.post("/financial-advice", async (req: Request, res: Response) => {
  try {
    const { profile, language } = parseRequest(req);
    const advice = await getFinancialAdvice(profile, language);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).json(advice);
  } catch (error) {
    console.error("financial-advice route error", error);
    return res.status(500).json({ error: "Unable to fetch financial advice" });
  }
});

export { financeRouter };
