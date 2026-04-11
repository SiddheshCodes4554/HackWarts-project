import { Router, Request, Response } from "express";
import { orchestrateChat } from "../orchestrator/orchestrator";
import { ChatRequestPayload } from "../utils/types";

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

    const response = await orchestrateChat({
      message,
      locale,
      latitude,
      longitude,
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error("Chat route error", error);

    return res.status(500).json({
      error: "Unable to process chat request",
    });
  }
});

export { chatRouter };
