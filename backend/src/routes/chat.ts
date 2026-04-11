import { Router, Request, Response } from "express";
import { orchestrateChat } from "../orchestrator/orchestrator";
import { ChatRequestPayload } from "../utils/types";

const chatRouter = Router();

chatRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const payload = req.body as Partial<ChatRequestPayload>;
    const message = typeof payload.message === "string" ? payload.message.trim() : "";

    if (!message) {
      return res.status(400).json({
        error: "message is required and must be a non-empty string",
      });
    }

    const response = await orchestrateChat({
      message,
      locale: typeof payload.locale === "string" ? payload.locale : undefined,
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
