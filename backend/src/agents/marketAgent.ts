import { AgentContext, AgentResult } from "../utils/types";
import { getMarketIntelligence } from "../services/marketIntelligence";

export async function marketAgent(context: AgentContext): Promise<AgentResult> {
  const marketData = await getMarketIntelligence(context);

  return {
    agent: "market",
    insight: `${marketData.sell_signal}: ${marketData.signal_reason} Best market: ${marketData.best_market?.market ?? "N/A"}.`,
    confidence: marketData.sell_signal === "SELL NOW" ? 0.84 : marketData.sell_signal === "HOLD 7 DAYS" ? 0.78 : 0.82,
    metadata: {
      locale: context.locale ?? "global",
      source: marketData.source,
      best_market: marketData.best_market?.market ?? "",
      commodity: marketData.commodity,
      sell_signal: marketData.sell_signal,
      latest_price: marketData.latest_price,
      average_90d: marketData.ninety_day_average,
      markets: marketData.markets.length,
    },
  };
}
