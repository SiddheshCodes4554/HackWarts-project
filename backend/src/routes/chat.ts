import { Router, Request, Response } from "express";
import { handleQuery } from "../orchestrator/orchestrator";
import { ChatRequestPayload, OrchestratedChatResponse } from "../utils/types";

const chatRouter = Router();

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
