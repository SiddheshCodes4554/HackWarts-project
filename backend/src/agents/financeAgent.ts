import { AgentContext, AgentResult } from "../utils/types";

export async function financeAgent(context: AgentContext): Promise<AgentResult> {
  await Promise.resolve();

  return {
    agent: "finance",
    insight: `Finance agent placeholder: estimate cash-flow and input-cost implications for \"${context.message}\".`,
    confidence: 0.58,
    metadata: {
      locale: context.locale ?? "global",
      source: "mock-finance-model",
    },
  };
}
