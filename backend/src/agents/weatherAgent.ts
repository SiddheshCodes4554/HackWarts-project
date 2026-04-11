import { AgentContext, AgentResult } from "../utils/types";

export async function weatherAgent(context: AgentContext): Promise<AgentResult> {
  await Promise.resolve();

  return {
    agent: "weather",
    insight: `Weather agent placeholder: monitor local precipitation trends for \"${context.message}\".`,
    confidence: 0.62,
    metadata: {
      locale: context.locale ?? "global",
      source: "mock-weather-feed",
    },
  };
}
