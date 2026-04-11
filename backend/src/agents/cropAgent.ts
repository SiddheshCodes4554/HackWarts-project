import { AgentContext, AgentResult } from "../utils/types";

export async function cropAgent(context: AgentContext): Promise<AgentResult> {
  await Promise.resolve();

  return {
    agent: "crop",
    insight: `Crop agent placeholder: evaluate crop-stage recommendations for \"${context.message}\".`,
    confidence: 0.66,
    metadata: {
      locale: context.locale ?? "global",
      source: "mock-crop-knowledge",
    },
  };
}
