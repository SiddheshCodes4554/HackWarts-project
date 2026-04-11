import { AgentContext, AgentResult } from "../utils/types";

export async function marketAgent(context: AgentContext): Promise<AgentResult> {
  await Promise.resolve();

  return {
    agent: "market",
    insight: `Market agent placeholder: track demand and price movement related to \"${context.message}\".`,
    confidence: 0.6,
    metadata: {
      locale: context.locale ?? "global",
      source: "mock-market-intel",
    },
  };
}
