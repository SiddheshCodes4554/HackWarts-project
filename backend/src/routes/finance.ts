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

function buildProfile(source: Record<string, unknown>): FinancialUserProfile {
  return {
    landOwned: toBoolean(source.landOwned, false),
    cropType: toText(source.cropType ?? source.crop),
    location: toText(source.location, "India"),
    incomeLevel: toText(source.incomeLevel, "medium"),
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
