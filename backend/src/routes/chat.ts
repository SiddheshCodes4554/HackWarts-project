import { Router, Request, Response } from "express";
import { handleQuery } from "../orchestrator/orchestrator";
import { ChatRequestPayload, OrchestratedChatResponse } from "../utils/types";
import { Alert } from "../models/Alert";

const chatRouter = Router();

function wantsActionPlan(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("what should i do") ||
    normalized.includes("what to do") ||
    normalized.includes("next action") ||
    normalized.includes("latest alerts") ||
    normalized.includes("ai decisions")
  );
}

chatRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const payload = req.body as Partial<ChatRequestPayload>;
    const rawMessage =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.query === "string"
          ? payload.query
          : "";
    const message = rawMessage.trim();
    const userId = typeof (payload as { userId?: unknown }).userId === "string"
      ? ((payload as { userId: string }).userId.trim().toLowerCase())
      : "";

    const latitude =
      typeof payload.location?.latitude === "number"
        ? payload.location.latitude
        : typeof payload.latitude === "number"
          ? payload.latitude
          : undefined;
    const longitude =
      typeof payload.location?.longitude === "number"
        ? payload.location.longitude
        : typeof payload.longitude === "number"
          ? payload.longitude
          : undefined;
    const locale =
      typeof payload.location?.placeName === "string"
        ? payload.location.placeName
        : typeof payload.locale === "string"
          ? payload.locale
          : undefined;

    if (!message) {
      return res.status(400).json({
        error: "message is required and must be a non-empty string",
      });
    }

    if (userId && wantsActionPlan(message)) {
      const latest = await Alert.find({ userId }).sort({ createdAt: -1 }).limit(6).lean();
      if (latest.length > 0) {
        const bullets = latest
          .filter((item) => item.type !== "summary")
          .slice(0, 5)
          .map((item) => `- ${item.message}`)
          .join("\n");
        const summary = latest.find((item) => item.type === "summary")?.message;

        const reply = [
          "Here are your latest AI decisions:",
          bullets || "- No active alerts yet.",
          summary ? `\n${summary}` : "",
        ].filter(Boolean).join("\n");

        return res.status(200).json({
          reply,
          final_message: reply,
          intent: "ai_decisions",
          weather: {},
          crops: {},
          market: {},
          finance: {},
          agentResults: [],
          timestamp: new Date().toISOString(),
        } as OrchestratedChatResponse);
      }
    }

    const response = await handleQuery(message, {
      latitude,
      longitude,
      placeName: locale,
      crop: typeof payload.crop === "string" ? payload.crop : undefined,
      disease: typeof payload.disease === "string" ? payload.disease : undefined,
      language: typeof payload.language === "string" ? payload.language : undefined,
      landOwned: typeof payload.landOwned === "boolean" ? payload.landOwned : undefined,
      incomeLevel: typeof payload.incomeLevel === "string" ? payload.incomeLevel : undefined,
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error("Chat route error", error);

    return res.status(503).json({
      error: error instanceof Error ? error.message : "Live AI unavailable",
    });
  }
});

export { chatRouter };
