import { cropAgent } from "../agents/cropAgent";
import { financeAgent } from "../agents/financeAgent";
import { marketAgent } from "../agents/marketAgent";
import { weatherAgent } from "../agents/weatherAgent";
import { generateGroqResponse } from "../services/groqService";
import {
  AgentContext,
  ChatRequestPayload,
  OrchestratedChatResponse,
} from "../utils/types";

export async function orchestrateChat(
  payload: ChatRequestPayload,
): Promise<OrchestratedChatResponse> {
  const context: AgentContext = {
    message: payload.message,
    locale: payload.locale,
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

  const reply = await generateGroqResponse({
    message: payload.message,
    contextSummary,
  });

  return {
    reply,
    agentResults,
    timestamp: context.timestamp,
  };
}
