import { cropAgent } from "../agents/cropAgent";
import { financeAgent } from "../agents/financeAgent";
import { marketAgent } from "../agents/marketAgent";
import { weatherAgent } from "../agents/weatherAgent";
import { detectIntent, generateResponse } from "../services/groqService";
import {
  AgentContext,
  ChatRequestPayload,
  OrchestratedChatResponse,
} from "../utils/types";

export async function orchestrateChat(
  payload: ChatRequestPayload,
): Promise<OrchestratedChatResponse> {
  const userMessage = (payload.message ?? payload.query ?? "").trim();

  const context: AgentContext = {
    message: userMessage,
    locale: payload.locale,
    latitude: payload.latitude,
    longitude: payload.longitude,
    timestamp: new Date().toISOString(),
  };

  const agentResults = await Promise.all([
    weatherAgent(context),
    cropAgent(context),
    marketAgent(context),
    financeAgent(context),
  ]);

  const contextSummary = agentResults
    .map((result) => `${result.agent}:${result.insight}`)
    .join(" | ");

  const detectedIntent = await detectIntent(userMessage);

  const llmResult = await generateResponse(
    [
      `User query: ${userMessage}`,
      `Detected intent: ${detectedIntent.intent}`,
      `Detected entities: ${JSON.stringify(detectedIntent.entities)}`,
      `Agent insights: ${contextSummary}`,
      "Return a concise and practical answer for a farmer.",
    ].join("\n"),
  );

  return {
    reply: llmResult.message,
    intent: detectedIntent.intent,
    agentResults,
    timestamp: context.timestamp,
  };
}
